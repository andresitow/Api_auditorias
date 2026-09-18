"""Valida los mismos JWT (HS256) que emite backend/src/auth — este servicio
no tiene login propio, confía en el token que ya emitió el backend NestJS
(ver backend/src/auth/strategies/jwt.strategy.ts, mismo JWT_SECRET)."""

from dataclasses import dataclass

import jwt
from fastapi import Header, HTTPException, status

from .config import JWT_ALGORITHM, JWT_SECRET


@dataclass
class AuthUser:
    sub: str
    username: str


def decode_token(token: str) -> AuthUser:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado") from exc
    return AuthUser(sub=str(payload.get("sub", "")), username=str(payload.get("username", "")))


def require_auth(authorization: str | None = Header(default=None)) -> AuthUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Falta el header Authorization")
    return decode_token(authorization.split(" ", 1)[1])
