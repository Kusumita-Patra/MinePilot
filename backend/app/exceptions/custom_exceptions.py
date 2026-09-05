class AppException(Exception):
    def __init__(self, message: str, status_code: int, errors: list | None = None):
        self.message = message
        self.status_code = status_code
        self.errors = errors or []
        super().__init__(message)


class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status_code=404)


class DuplicateError(AppException):
    def __init__(self, message: str = "Resource already exists"):
        super().__init__(message, status_code=409)


class InvalidTransitionError(AppException):
    def __init__(self, message: str = "Invalid status transition"):
        super().__init__(message, status_code=409)


class UnauthorizedError(AppException):
    def __init__(self, message: str = "Invalid credentials"):
        super().__init__(message, status_code=401)


class ForbiddenError(AppException):
    def __init__(self, message: str = "Not permitted"):
        super().__init__(message, status_code=403)
