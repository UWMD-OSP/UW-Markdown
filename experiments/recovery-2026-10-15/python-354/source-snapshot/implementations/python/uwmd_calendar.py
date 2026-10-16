"""Protocol VIII.3 Gregorian predicate; character-only, including year 0000."""
import re


def calendar_date(value):
    if not isinstance(value, str) or not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}', value):
        return False
    year, month, day = int(value[:4]), int(value[5:7]), int(value[8:])
    leap = year % 400 == 0 or year % 4 == 0 and year % 100 != 0
    lengths = (31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
    return 1 <= month <= 12 and 1 <= day <= lengths[month - 1]
