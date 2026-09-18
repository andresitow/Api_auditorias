"""Registro de WebSockets por job_id. Guarda el historial de mensajes de cada job
para poder "reproducirlo" a un cliente que se conecta tarde (el POST que crea el
job y el connect del WebSocket del navegador no son atómicos, hay una carrera)."""

import asyncio

from fastapi import WebSocket


class JobHub:
    def __init__(self) -> None:
        self._history: dict[str, list[dict]] = {}
        self._sockets: dict[str, list[WebSocket]] = {}
        self._lock = asyncio.Lock()

    def start(self, job_id: str) -> None:
        self._history[job_id] = []
        self._sockets[job_id] = []

    def forget(self, job_id: str) -> None:
        self._history.pop(job_id, None)
        self._sockets.pop(job_id, None)

    async def publish(self, job_id: str, message: dict) -> None:
        async with self._lock:
            self._history.setdefault(job_id, []).append(message)
            sockets = list(self._sockets.get(job_id, []))
        for ws in sockets:
            try:
                await ws.send_json(message)
            except Exception:
                pass

    async def register(self, job_id: str, ws: WebSocket) -> None:
        async with self._lock:
            self._sockets.setdefault(job_id, []).append(ws)
            backlog = list(self._history.get(job_id, []))
        for message in backlog:
            await ws.send_json(message)

    async def unregister(self, job_id: str, ws: WebSocket) -> None:
        async with self._lock:
            sockets = self._sockets.get(job_id)
            if sockets and ws in sockets:
                sockets.remove(ws)


hub = JobHub()
