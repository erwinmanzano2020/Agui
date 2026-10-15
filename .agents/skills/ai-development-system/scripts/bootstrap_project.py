#!/usr/bin/env python3
"""Add the development workflow without replacing project authority or history."""
import argparse
import json
import shutil
from pathlib import Path

PROFILE_SKILLS = {
    name: ['systematic-debugging', 'risk-aware-testing', 'adversarial-review']
    for name in ['greenfield', 'agui', 'vvs-ops-mini', 'nextjs-supabase', 'nextjs-appscript']
}
TEMPLATE_MAP = {'AGENTS.template.md': 'AGENTS.md', 'SPEC.template.md': 'SPEC.md', 'ARCHITECTURE.template.md': 'ARCHITECTURE.md'}


def read_json(path):
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding='utf-8'))


def detect_profile(root):
    # Existing explicit architecture beats repository naming and dependencies.
    manifest = read_json(root / '.ai-development/manifest.json') or {}
    if manifest.get('profile') in PROFILE_SKILLS:
        return manifest['profile']
    name = root.name.lower()
    if name == 'agui':
        return 'agui'
    if name in ('vvs-ops-mini', 'vvs_ops_mini'):
        return 'vvs-ops-mini'
    pkg = read_json(root / 'package.json') or read_json(root / 'agui-starter/package.json') or {}
    deps = {**pkg.get('dependencies', {}), **pkg.get('devDependencies', {})}
    if 'next' in deps and any(k in deps for k in ['@supabase/supabase-js', '@supabase/auth-js', '@supabase/ssr', 'pg']):
        return 'nextjs-supabase'
    if 'next' in deps and (root / 'apps-script').exists():
        return 'nextjs-appscript'
    return 'greenfield'


def copy_if_missing(src, dst, dry_run):
    if dst.exists() or dst.is_symlink():
        return 'preserved'
    if dry_run:
        return 'would-create'
    dst.parent.mkdir(parents=True, exist_ok=True)
    with src.open('rb') as source, dst.open('xb') as target:
        shutil.copyfileobj(source, target)
    return 'created'


def install_skill(name, library_root, project_root, dry_run):
    src = library_root / 'custom' / name
    if not src.exists():
        src = library_root / 'curated' / name
    if not (src / 'SKILL.md').exists() and (src / 'payload/SKILL.md').exists():
        src = src / 'payload'
    dst = project_root / '.agents/skills' / name
    if dst.exists() or dst.is_symlink():
        return {'skill': name, 'status': 'preserved-existing'}
    if not (src / 'SKILL.md').exists():
        return {'skill': name, 'status': 'missing-from-library'}
    if not dry_run:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(src, dst, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    return {'skill': name, 'status': 'would-install' if dry_run else 'installed'}


def initial_state(name, profile):
    return {
        'schema_version': 1,
        'project': {'name': name, 'repository': 'UNVERIFIED', 'profile': profile},
        'scope': {'active_phase': 'Reconstruct from project governance', 'authority': [], 'prohibited': ['No production activation inferred from tooling adoption']},
        'workspace': {'execution': 'work', 'source_mode': 'unverified', 'durability': 'UNVERIFIED; establish and sync durable source before claiming a save', 'limitations': ['Work cannot directly operate the owner computer', 'Transient workspace is not durable storage']},
        'current': {'milestone': 'Bootstrap', 'outcome': 'First complete user journey', 'risk': 'STANDARD', 'stage': 'STATE_RECONSTRUCTION_REQUIRED', 'next_action': 'Read governance and verify current source, checks and project state', 'blockers': ['Current technical evidence not reconstructed']},
        'checks': {'source_head': '0' * 40, 'required': []},
        'capabilities': [],
        'owner_session': {'status': 'NOT_PREPARED', 'cleanup': 'NOT_RUN'},
        'uat': [],
        'metrics': {key: None for key in ['owner_interruptions', 'manual_commands', 'repeated_cases', 'recovery_minutes']},
    }


def write_missing(path, content, dry_run):
    if path.exists() or path.is_symlink():
        return 'preserved'
    if not dry_run:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('x', encoding='utf-8') as file:
            file.write(content)
    return 'would-create' if dry_run else 'created'


def bootstrap(root, library, name, profile=None, control_center=None, dry_run=False, ui=False):
    root, library = Path(root).resolve(), Path(library).resolve()
    # Refuse symlinked destinations before copying; never traverse outside project.
    for part in ['.ai-development', '.agents', '.agents/skills', '.ai-development/tools']:
        if (root / part).is_symlink():
            raise ValueError('SYMLINKED_DESTINATION_FORBIDDEN')
    profile = profile or detect_profile(root)
    assets = Path(__file__).resolve().parent.parent / 'assets'
    skills = ['ai-development-system', 'delivery-convergence', *PROFILE_SKILLS[profile]]
    if ui:
        skills += ['vercel-react-best-practices', 'ui-ux-pro-max']
    skill_plan = [install_skill(skill, library, root, True) for skill in skills]
    if any(item['status'] == 'missing-from-library' for item in skill_plan):
        return {'status': 'INCOMPLETE', 'profile': profile, 'skills': skill_plan, 'note': 'Missing selected skill sources; no project files were changed.'}
    results = {target: copy_if_missing(assets / source, root / target, dry_run) for source, target in TEMPLATE_MAP.items()}
    results['skills'] = [install_skill(skill, library, root, dry_run) for skill in skills]
    manifest = {'system': 'AI Magic Development System', 'version': 4, 'project_name': name, 'profile': profile, 'selected_skills': skills, 'control_center_url': control_center, 'authority_rule': 'Project governance outranks reusable tools and skills.', 'workflow_state': '.ai-development/state.json', 'execution': 'work'}
    results['manifest'] = write_missing(root / '.ai-development/manifest.json', json.dumps(manifest, indent=2) + '\n', dry_run)
    results['state'] = write_missing(root / '.ai-development/state.json', json.dumps(initial_state(name, profile), indent=2) + '\n', dry_run)
    results['resume'] = write_missing(root / '.ai-development/RESUME.md', '# Resume\n\nRead AGENTS.md and project governance first. Load .agents/skills/ai-development-system/SKILL.md. Run `node project.mjs status`; verify its evidence against source and current services. State is an index, never authorization. Reconstruct unverified fields, then complete one authorized user-visible outcome.\n', dry_run)
    results['entry'] = write_missing(root / '.ai-development/WORKFLOW_ENTRY.md', '# Current workflow entry\n\nPreserve historical resume notes. Read project governance, then .agents/skills/ai-development-system/SKILL.md and state.json. Run `node project.mjs status` and verify its linked evidence. Reconstruct current state before trusting old rollout instructions. No activation authority is granted by installation.\n', dry_run)
    results['tools'] = copy_if_missing(Path(__file__).with_name('workflow.mjs'), root / '.ai-development/tools/workflow.mjs', dry_run)
    for source, target in [('project.mjs', 'project.mjs'), ('project.cmd', 'project.cmd'), ('owner-adapter.template.json', '.ai-development/owner-adapter.json')]:
        results[target] = copy_if_missing(assets / source, root / target, dry_run)
    return {'status': 'DRY_RUN' if dry_run else 'INSTALLED', 'profile': profile, 'results': results, 'note': 'Existing governance, state, manifests, resumes and installed skills are preserved. Explicit reviewed sync is required for upgrades.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project-root', required=True)
    parser.add_argument('--project-name', required=True)
    parser.add_argument('--library-root', required=True)
    parser.add_argument('--profile', choices=sorted(PROFILE_SKILLS))
    parser.add_argument('--control-center-url')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--with-ui-skills', action='store_true')
    args = parser.parse_args()
    result = bootstrap(args.project_root, args.library_root, args.project_name, args.profile, args.control_center_url, args.dry_run, args.with_ui_skills)
    print(json.dumps(result, indent=2))
    if result['status'] == 'INCOMPLETE':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
