"""Pruebas de app/security.py, app/main.py (con TestClient, BD simulada), app/ws_manager.py,
app/jobs.py y app/db.py::_build_engine. Nunca se toca Postgres real."""

import asyncio
import time

import jwt
import pandas as pd
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import jobs, main, security
from app.config import JWT_ALGORITHM, JWT_SECRET
from app.db import _build_engine
from app.ws_manager import JobHub
from conftest import a_bytes, crear_plan_nativo, crear_plantilla


def token(sub="u1", username="ana", secret=JWT_SECRET, **extra):
    return jwt.encode({"sub": sub, "username": username, **extra}, secret, algorithm=JWT_ALGORITHM)


def auth(**kw):
    return {"Authorization": f"Bearer {token(**kw)}"}


@pytest.fixture
def client():
    return TestClient(main.app)


# ------------------------------------------------------------------------ security ---


class TestSecurity:
    def test_decode_token_valido(self):
        user = security.decode_token(token(sub="42", username="paula"))
        assert (user.sub, user.username) == ("42", "paula")

    def test_token_con_firma_incorrecta(self):
        with pytest.raises(HTTPException) as e:
            security.decode_token(token(secret="otro-secreto-distinto-de-32-bytes-min!!"))
        assert e.value.status_code == 401

    def test_token_expirado(self):
        with pytest.raises(HTTPException) as e:
            security.decode_token(token(exp=int(time.time()) - 60))
        assert e.value.status_code == 401

    def test_token_basura(self):
        with pytest.raises(HTTPException):
            security.decode_token("no.es.jwt")

    def test_claims_faltantes_dan_cadena_vacia(self):
        t = jwt.encode({}, JWT_SECRET, algorithm=JWT_ALGORITHM)
        user = security.decode_token(t)
        assert (user.sub, user.username) == ("", "")

    def test_algoritmo_none_es_rechazado(self):
        t = jwt.encode({"sub": "1"}, key=None, algorithm="none")
        with pytest.raises(HTTPException):
            security.decode_token(t)

    def test_require_auth_sin_header(self):
        with pytest.raises(HTTPException) as e:
            security.require_auth(None)
        assert e.value.status_code == 401

    def test_require_auth_esquema_incorrecto(self):
        with pytest.raises(HTTPException):
            security.require_auth("Basic abc")

    def test_require_auth_bearer_insensible_a_mayusculas(self):
        assert security.require_auth(f"bearer {token()}").username == "ana"


# --------------------------------------------------------------------------- API ---


class TestApi:
    def test_health_es_publico(self, client):
        assert client.get("/health").json() == {"ok": True}

    @pytest.mark.parametrize(
        "metodo,ruta",
        [
            ("post", "/jobs"),
            ("get", "/jobs/x/resumen"),
            ("get", "/jobs/x/excel"),
            ("get", "/jobs/x/pdf"),
            ("get", "/auditorias/a/export/excel?anio=2026"),
            ("get", "/auditorias/a/export/pdf?anio=2026"),
            ("post", "/plan-trabajo/parse-excel"),
        ],
    )
    def test_endpoints_protegidos_devuelven_401_sin_token(self, client, metodo, ruta):
        assert getattr(client, metodo)(ruta).status_code == 401

    def test_job_inexistente_404(self, client):
        for ruta in ("resumen", "excel", "pdf"):
            assert client.get(f"/jobs/no-existe/{ruta}", headers=auth()).status_code == 404

    def test_descarga_de_resultados_de_un_job(self, client):
        jobs._results["j1"] = {
            "resumen": {"anioPlan": 2027},
            "categorias": [{"categoria": "S"}],
            "plan": [{"x": 1}],
            "files": {"excel": b"EXCEL", "pdf": b"%PDF"},
            "createdAt": time.time(),
        }
        try:
            r = client.get("/jobs/j1/resumen", headers=auth())
            assert r.json() == {"resumen": {"anioPlan": 2027}, "categorias": [{"categoria": "S"}], "plan": [{"x": 1}]}
            x = client.get("/jobs/j1/excel", headers=auth())
            assert x.content == b"EXCEL"
            assert "plan-accion-2027.xlsx" in x.headers["content-disposition"]
            assert x.headers["content-type"].startswith("application/vnd.openxmlformats")
            p = client.get("/jobs/j1/pdf", headers=auth())
            assert p.content == b"%PDF"
            assert p.headers["content-type"] == "application/pdf"
        finally:
            jobs._results.pop("j1", None)

    def test_crear_job_devuelve_id(self, client, monkeypatch):
        async def falso(auditoria_id, anio):
            assert (auditoria_id, anio) == ("aud-1", 2027)
            return "job-123"

        monkeypatch.setattr(jobs, "start_job", falso)
        r = client.post("/jobs", json={"auditoriaId": "aud-1", "anio": 2027}, headers=auth())
        assert r.json() == {"jobId": "job-123"}

    def test_crear_job_valida_el_cuerpo(self, client):
        assert client.post("/jobs", json={"auditoriaId": "a"}, headers=auth()).status_code == 422

    def test_export_excel_404_si_la_auditoria_no_existe(self, client, monkeypatch):
        monkeypatch.setattr(main.db, "fetch_auditoria", lambda _id: None)
        r = client.get("/auditorias/a/export/excel?anio=2026", headers=auth())
        assert r.status_code == 404

    def test_export_excel_pasa_filtros_y_devuelve_xlsx(self, client, monkeypatch):
        capturado = {}
        monkeypatch.setattr(main.db, "fetch_auditoria", lambda _id: {"id": _id, "nombre": "Aud"})

        def fetch(aid, anio, categoria, estado):
            capturado.update(aid=aid, anio=anio, categoria=categoria, estado=estado)
            return pd.DataFrame(
                columns=["activity_id", "categoria", "actividad", "descripcion", "responsable",
                         "frecuencia", "occurrence_id", "fecha_programada", "estado"]
            )

        monkeypatch.setattr(main.db, "fetch_activities_for_export", fetch)
        r = client.get("/auditorias/a1/export/excel?anio=2026&categoria=Switches&estado=EJECUTADO", headers=auth())
        assert r.status_code == 200
        assert capturado == {"aid": "a1", "anio": 2026, "categoria": "Switches", "estado": "EJECUTADO"}
        assert "plan-trabajo-2026.xlsx" in r.headers["content-disposition"]
        assert r.content[:2] == b"PK"  # zip/xlsx

    def test_export_pdf_no_filtra_por_estado(self, client, monkeypatch):
        capturado = {}
        monkeypatch.setattr(main.db, "fetch_auditoria", lambda _id: {"id": _id, "nombre": "Aud"})

        def fetch(aid, anio, categoria, estado):
            capturado["estado"] = estado
            return pd.DataFrame(
                columns=["activity_id", "categoria", "actividad", "descripcion", "responsable",
                         "frecuencia", "occurrence_id", "fecha_programada", "estado"]
            )

        monkeypatch.setattr(main.db, "fetch_activities_for_export", fetch)
        r = client.get("/auditorias/a1/export/pdf?anio=2026", headers=auth())
        assert r.status_code == 200
        assert capturado["estado"] is None
        assert r.content.startswith(b"%PDF")

    def test_parse_excel_plantilla(self, client):
        contenido = a_bytes(
            crear_plantilla(
                [
                    ("Servidores", "A", "Ana", "MENSUAL", None, None, None, None),
                    ("Servidores", "B", None, "MENSUAL", None, None, None, None),
                ]
            )
        )
        r = client.post(
            "/plan-trabajo/parse-excel",
            files={"file": ("plan.xlsx", contenido)},
            headers=auth(),
        )
        assert r.status_code == 200
        body = r.json()
        assert body["formato"] == "plantilla"
        assert [f["nombre"] for f in body["filas"]] == ["A"]
        assert body["errores"] == [{"fila": 3, "motivo": "Falta el responsable"}]
        # el contrato que consume backend/import-excel.service.ts
        assert set(body["filas"][0]) == {
            "fila", "categoria", "nombre", "responsable", "frecuencia", "descripcionEvidencia",
            "observacion", "activa", "fechaEspecifica", "periodos",
        }

    def test_parse_excel_nativo_incluye_periodos(self, client):
        wb = crear_plan_nativo(
            [("UPS", [{"nombre": "A", "descripcion": None, "responsable": "Ana", "frecuencia": "ANUAL", "marcas": {(0, 0): "E"}}])]
        )
        r = client.post("/plan-trabajo/parse-excel", files={"file": ("p.xlsx", a_bytes(wb))}, headers=auth())
        body = r.json()
        assert body["formato"] == "nativo" and body["anio"] == 2026
        assert body["filas"][0]["periodos"] == [{"periodo": "2026", "estado": "EJECUTADO", "esAdHoc": False}]

    def test_parse_excel_archivo_invalido_400(self, client):
        r = client.post("/plan-trabajo/parse-excel", files={"file": ("x.xlsx", b"basura")}, headers=auth())
        assert r.status_code == 400
        assert r.json()["detail"] == "El archivo no es un .xlsx válido"

    def test_parse_excel_sin_categorias_400_con_mensaje(self, client):
        contenido = a_bytes(crear_plan_nativo([]))
        r = client.post("/plan-trabajo/parse-excel", files={"file": ("x.xlsx", contenido)}, headers=auth())
        assert r.status_code == 400
        assert "sección/categoría" in r.json()["detail"]

    def test_websocket_sin_token_se_cierra_4401(self, client):
        from starlette.websockets import WebSocketDisconnect

        with pytest.raises(WebSocketDisconnect) as e:
            with client.websocket_connect("/ws/jobs/j1"):
                pass
        assert e.value.code == 4401

    def test_websocket_token_invalido_se_cierra_4401(self, client):
        from starlette.websockets import WebSocketDisconnect

        with pytest.raises(WebSocketDisconnect) as e:
            with client.websocket_connect("/ws/jobs/j1?token=malo"):
                pass
        assert e.value.code == 4401

    def test_websocket_reproduce_el_historial_a_un_cliente_tardio(self, client):
        jobs.hub.start("jws")
        asyncio.run(jobs.hub.publish("jws", {"status": "analizando", "progress": 20}))
        try:
            with client.websocket_connect(f"/ws/jobs/jws?token={token()}") as ws:
                assert ws.receive_json() == {"status": "analizando", "progress": 20}
        finally:
            jobs.hub.forget("jws")


# ------------------------------------------------------------------------ JobHub ---


class FakeWS:
    def __init__(self, falla=False):
        self.enviados = []
        self.falla = falla

    async def send_json(self, m):
        if self.falla:
            raise RuntimeError("cerrado")
        self.enviados.append(m)


class TestJobHub:
    def test_publish_guarda_historial_y_envia_a_los_sockets(self):
        async def caso():
            hub = JobHub()
            hub.start("j")
            ws = FakeWS()
            await hub.register("j", ws)
            await hub.publish("j", {"n": 1})
            assert ws.enviados == [{"n": 1}]
            assert hub._history["j"] == [{"n": 1}]

        asyncio.run(caso())

    def test_register_reproduce_el_backlog_en_orden(self):
        async def caso():
            hub = JobHub()
            hub.start("j")
            await hub.publish("j", {"n": 1})
            await hub.publish("j", {"n": 2})
            ws = FakeWS()
            await hub.register("j", ws)
            assert ws.enviados == [{"n": 1}, {"n": 2}]

        asyncio.run(caso())

    def test_un_socket_roto_no_impide_avisar_a_los_demas(self):
        async def caso():
            hub = JobHub()
            hub.start("j")
            roto, sano = FakeWS(falla=True), FakeWS()
            await hub.register("j", roto)
            await hub.register("j", sano)
            await hub.publish("j", {"n": 1})
            assert sano.enviados == [{"n": 1}]

        asyncio.run(caso())

    def test_unregister_y_forget(self):
        async def caso():
            hub = JobHub()
            hub.start("j")
            ws = FakeWS()
            await hub.register("j", ws)
            await hub.unregister("j", ws)
            await hub.publish("j", {"n": 1})
            assert ws.enviados == []
            await hub.unregister("j", ws)  # idempotente
            hub.forget("j")
            assert "j" not in hub._history and "j" not in hub._sockets

        asyncio.run(caso())

    def test_publish_sobre_job_no_iniciado_crea_historial(self):
        async def caso():
            hub = JobHub()
            await hub.publish("nuevo", {"n": 1})
            assert hub._history["nuevo"] == [{"n": 1}]

        asyncio.run(caso())


# -------------------------------------------------------------------------- jobs ---


class TestJobs:
    def test_prune_expired_elimina_solo_los_vencidos(self, monkeypatch):
        monkeypatch.setattr(jobs, "JOB_TTL_SECONDS", 100)
        jobs.hub.start("viejo")
        jobs._results["viejo"] = {"createdAt": time.time() - 500}
        jobs._results["nuevo"] = {"createdAt": time.time()}
        try:
            jobs._prune_expired()
            assert "viejo" not in jobs._results
            assert "viejo" not in jobs.hub._history
            assert "nuevo" in jobs._results
        finally:
            jobs._results.pop("nuevo", None)
            jobs._results.pop("viejo", None)

    def test_get_result(self):
        assert jobs.get_result("nada") is None

    def _parchar_db(self, monkeypatch, df, auditoria=None):
        monkeypatch.setattr(jobs.db, "fetch_auditoria", lambda _id: auditoria)
        monkeypatch.setattr(jobs.db, "fetch_config", lambda: {"semaforoVerdePct": 90, "semaforoAmarilloPct": 70})
        monkeypatch.setattr(jobs.db, "fetch_activities_with_occurrences", lambda a, anio: df)

    def _estados(self, job_id):
        return [m["status"] for m in jobs.hub._history[job_id]]

    def test_run_auditoria_inexistente_publica_error(self, monkeypatch):
        self._parchar_db(monkeypatch, pd.DataFrame(), auditoria=None)
        jobs.hub.start("j-x")
        asyncio.run(jobs._run("j-x", "aud", 2027))
        assert self._estados("j-x")[-1] == "error"
        assert "no existe" in jobs.hub._history["j-x"][-1]["mensaje"]
        assert jobs.get_result("j-x") is None
        jobs.hub.forget("j-x")

    def test_run_sin_actividades_publica_error(self, monkeypatch):
        self._parchar_db(monkeypatch, pd.DataFrame(), auditoria={"id": "a", "nombre": "A"})
        jobs.hub.start("j-y")
        asyncio.run(jobs._run("j-y", "aud", 2027))
        last = jobs.hub._history["j-y"][-1]
        assert last["status"] == "error"
        assert "2026" in last["mensaje"]  # año base = plan - 1
        jobs.hub.forget("j-y")

    def test_run_exitoso_guarda_resultado_y_publica_progreso_creciente(self, monkeypatch):
        df = pd.DataFrame(
            [dict(activity_id="a1", categoria="Servidores", actividad="Backups", responsable="Ana",
                  frecuencia="MENSUAL", occurrence_id=f"o{i}", estado="EJECUTADO") for i in range(4)]
            + [dict(activity_id="a2", categoria="Switches", actividad="FW", responsable="Luis",
                    frecuencia="TRIMESTRAL", occurrence_id=f"p{i}", estado="NO_REALIZADO") for i in range(4)]
        )
        self._parchar_db(monkeypatch, df, auditoria={"id": "a", "nombre": "Aud X"})
        jobs.hub.start("j-ok")
        try:
            asyncio.run(jobs._run("j-ok", "aud", 2027))
            estados = self._estados("j-ok")
            assert estados == ["conectando", "analizando", "construyendo_plan", "generando_excel", "generando_pdf", "listo"]
            progreso = [m["progress"] for m in jobs.hub._history["j-ok"]]
            assert progreso == sorted(progreso) and progreso[-1] == 100
            res = jobs.get_result("j-ok")
            r = res["resumen"]
            assert (r["anioBase"], r["anioPlan"]) == (2026, 2027)
            assert r["totalActividades"] == 2
            assert r["cumplimientoGeneral"] == 50.0
            assert (r["riesgoAlto"], r["riesgoMedio"], r["riesgoBajo"]) == (1, 0, 1)
            assert res["files"]["excel"][:2] == b"PK"
            assert res["files"]["pdf"].startswith(b"%PDF")
            assert "activity_id" not in res["plan"][0]  # se oculta el id interno
        finally:
            jobs._results.pop("j-ok", None)
            jobs.hub.forget("j-ok")

    def test_run_captura_excepciones_y_las_publica(self, monkeypatch):
        def boom(_id):
            raise RuntimeError("BD caída")

        monkeypatch.setattr(jobs.db, "fetch_auditoria", boom)
        jobs.hub.start("j-err")
        asyncio.run(jobs._run("j-err", "aud", 2027))
        last = jobs.hub._history["j-err"][-1]
        assert last["status"] == "error" and "BD caída" in last["mensaje"]
        jobs.hub.forget("j-err")

    def test_start_job_devuelve_id_hex_y_arranca_el_hub(self, monkeypatch):
        async def falso_run(*a, **k):
            return None

        monkeypatch.setattr(jobs, "_run", falso_run)

        async def caso():
            jid = await jobs.start_job("aud", 2027)
            await asyncio.sleep(0)
            return jid

        jid = asyncio.run(caso())
        assert len(jid) == 32 and int(jid, 16) >= 0
        assert jid in jobs.hub._history
        jobs.hub.forget(jid)


# ---------------------------------------------------------------------------- db ---


class TestBuildEngine:
    """Se intercepta create_engine para inspeccionar la URL y connect_args sin abrir conexiones."""

    def _capturar(self, monkeypatch, url):
        capturado = {}

        def falso(u, **kwargs):
            capturado["url"] = u
            capturado["kwargs"] = kwargs
            return object()

        monkeypatch.setattr("app.db.create_engine", falso)
        _build_engine(url)
        return capturado

    def test_quita_el_parametro_schema_de_prisma(self, monkeypatch):
        c = self._capturar(monkeypatch, "postgresql://u:p@h:5432/db?schema=public")
        assert "schema" not in c["url"].query
        assert c["kwargs"]["connect_args"] == {}

    def test_schema_no_default_se_aplica_via_search_path(self, monkeypatch):
        c = self._capturar(monkeypatch, "postgresql://u:p@h:5432/db?schema=auditorias")
        assert "schema" not in c["url"].query
        assert c["kwargs"]["connect_args"] == {"options": "-csearch_path=auditorias"}

    def test_conserva_otros_parametros_de_la_url(self, monkeypatch):
        c = self._capturar(monkeypatch, "postgresql://u:p@h:5432/db?schema=public&sslmode=require")
        assert dict(c["url"].query) == {"sslmode": "require"}

    def test_sin_schema(self, monkeypatch):
        c = self._capturar(monkeypatch, "postgresql://u:p@h:5432/db")
        assert c["url"].database == "db"
        assert c["kwargs"]["connect_args"] == {}
        assert c["kwargs"]["pool_pre_ping"] is True
