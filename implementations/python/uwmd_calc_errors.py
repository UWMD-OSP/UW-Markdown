"""Existing calc errors, without validation-diagnostic fallback allocation."""


class CalcError(ValueError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code

    def projection(self):
        return {"category": "calc", "code": self.code, "message": str(self)}


class CalcUnavailable(ValueError):
    """Local unavailable input boundary; never a fabricated CalcResult code."""
