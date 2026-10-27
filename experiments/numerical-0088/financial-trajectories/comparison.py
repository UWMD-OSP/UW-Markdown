"""Compare NaNs by class while preserving every finite and infinite word."""


def normalized(value):
    if isinstance(value, dict):
        # Original bits stay in raw artifacts; only this comparison is class-only.
        return {key: normalized(item) for key, item in value.items() if not (value.get('kind') == 'nan' and key == 'bits')}
    if isinstance(value, list): return [normalized(item) for item in value]
    return value
