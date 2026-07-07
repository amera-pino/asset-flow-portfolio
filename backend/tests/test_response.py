from app.schemas.response import success_response


def test_success_response_returns_common_api_shape() -> None:
    payload = {"status": "ok"}

    response = success_response(payload)

    assert response == {
        "success": True,
        "data": payload,
        "error": None,
    }
