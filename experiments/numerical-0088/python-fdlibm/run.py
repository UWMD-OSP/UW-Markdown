"""Raw JSONL stream; inputs and non-NaN output words use existing lab protocol."""
import json
import sys
from kernel import evaluate_record

if __name__ == '__main__':
    for line in sys.stdin:
        if line.strip():
            print(json.dumps(evaluate_record(json.loads(line)), separators=(',', ':')))
