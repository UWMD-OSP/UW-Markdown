"""Raw JSONL stream; inputs and non-NaN output words use existing lab protocol."""
import json
import sys
from kernel import evaluate_record, require_binary64

if __name__ == '__main__':
    require_binary64()
    for line in sys.stdin:
        if line.strip():
            print(json.dumps(evaluate_record(json.loads(line)), separators=(',', ':')))
