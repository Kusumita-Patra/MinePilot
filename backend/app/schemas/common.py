from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class SuccessResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str = "Operation successful"
    data: T


class ErrorDetail(BaseModel):
    field: str
    message: str


class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    status_code: int
    errors: list[ErrorDetail | dict[str, Any]] = []


def success_body(data: Any, message: str = "Operation successful") -> dict:
    return {"success": True, "message": message, "data": data}


def error_body(message: str, status_code: int, errors: list | None = None) -> dict:
    return {"success": False, "message": message, "status_code": status_code, "errors": errors or []}
