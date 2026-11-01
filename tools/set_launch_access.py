"""Open/close NEW free enrollments. Existing installed grants are unaffected.

python tools/set_launch_access.py --close
python tools/set_launch_access.py --open
Then commit, push and run deploy-content-fire6.yml. No new app build is needed
to change this policy after the 1.3.0 app is installed.
"""
import argparse, json, subprocess, sys
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
mode = parser.add_mutually_exclusive_group(required=True)
mode.add_argument('--open', action='store_true')
mode.add_argument('--close', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
path = root / 'content/access-policy.json'
policy = json.loads(path.read_text(encoding='utf8'))
policy['enrollmentOpen'] = args.open
path.write_text(json.dumps(policy, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf8', newline='\n')
subprocess.run([sys.executable, str(root / 'tools/content_manifest.py')], cwd=root, check=True)
print('New free enrollments:', 'OPEN' if args.open else 'CLOSED')
print('Existing stored free rights are retained. Commit/push and deploy the content policy next.')
