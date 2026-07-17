import pandas as pd

from data import compute


def test_public_trials_excludes_legacy_name_token():
    rows = pd.DataFrame(
        {
            "trial_name": [
                "_claude-code_glm-5.2_run_002",
                "_claude-code_glm-5.2_run_002_legacy",
                "_claude-code_glm-5.2_run_002_legacy_20260716",
                "_claude-code_legacy-model_run_001",
            ]
        }
    )

    assert compute._public_trials(rows)["trial_name"].tolist() == [
        "_claude-code_glm-5.2_run_002",
        "_claude-code_legacy-model_run_001",
    ]


def test_all_public_loaders_apply_legacy_filter(tmp_path, monkeypatch):
    rows = pd.DataFrame(
        {
            "trial_type": ["e2e", "e2e", "mstone"],
            "trial_name": [
                "_canonical",
                "_canonical_legacy",
                "_mstone_canonical",
            ],
            "eval_status": ["passed", "failed", "passed"],
        }
    )
    paths = {}
    for attr in ("MILESTONE_CSV", "EXECUTION_CSV", "TRIAL_CSV"):
        path = tmp_path / f"{attr.lower()}.csv"
        rows.to_csv(path, index=False)
        paths[attr] = path
        monkeypatch.setattr(compute, attr, path)

    assert compute.load_e2e()["trial_name"].tolist() == ["_canonical"]
    assert compute.load_executions()["trial_name"].tolist() == ["_canonical"]
    assert compute.load_trial_results()["trial_name"].tolist() == ["_canonical"]
