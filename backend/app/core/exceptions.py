from http import HTTPStatus


class AppHttpError(Exception):
    code = "APP_HTTP_ERROR"
    status_code = HTTPStatus.INTERNAL_SERVER_ERROR

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class ServiceUnavailableError(AppHttpError):
    code = "SERVICE_UNAVAILABLE"
    status_code = HTTPStatus.SERVICE_UNAVAILABLE


class GatewayTimeoutError(AppHttpError):
    code = "GATEWAY_TIMEOUT"
    status_code = HTTPStatus.GATEWAY_TIMEOUT


class ContextualInternalServerError(AppHttpError):
    status_code = HTTPStatus.INTERNAL_SERVER_ERROR

    def __init__(self, code: str, message: str = "") -> None:
        self.code = code
        super().__init__(message)
