# Software Requirements Specification: M13 - Documentation and Testing Updates

## Overview

This milestone addresses the need for improved testing infrastructure for docstring consistency verification and enhanced metadata routing test coverage. The requirements focus on:

1. **FR1**: Docstring Consistency Assertion Utility - A new testing utility function to verify that related classes and functions have consistent docstring documentation for their parameters, attributes, and returns
2. **FR2**: Numpydoc Skip Decorator - A pytest skip decorator for tests requiring the numpydoc package
3. **FR3**: Stacking Estimators Docstring Consistency - Ensure docstrings for StackingClassifier and StackingRegressor have consistent documentation
4. **FR4**: Precision-Recall Metrics Docstring Consistency - Ensure related precision/recall/f-score metric functions have consistent parameter documentation
5. **FR5**: TunedThresholdClassifierCV Metadata Routing Compatibility - Add metadata routing test coverage for TunedThresholdClassifierCV

**Affected Modules**:
- `sklearn/utils/_testing.py`
- `sklearn/tests/test_docstring_parameters.py`
- `sklearn/utils/tests/test_testing.py`
- `sklearn/tests/test_metaestimators_metadata_routing.py`
- `sklearn/model_selection/_classification_threshold.py`
- `sklearn/ensemble/_stacking.py`

---

## Requirements

### FR1: Docstring Consistency Assertion Utility

**Problem**: There is no testing utility to verify that related functions, classes, or data descriptors have consistent docstring documentation for shared parameters, attributes, and returns.

**Requirements**:
- Implement a function `assert_docstring_consistency` in `sklearn.utils._testing` that checks whether multiple objects (functions, classes, or data descriptors) have consistent docstrings
- The function must verify consistency of:
  - Type specifications for parameters, attributes, and returns
  - Descriptions for parameters, attributes, and returns
- **IMPORTANT**: Type specifications and descriptions must be checked **separately** - if type specs differ, report "type specification" inconsistency; if descriptions differ, report "description" inconsistency
- **Grouping**: Objects with identical type/description are grouped together (e.g., `['func_a', 'func_b']`). Different groups are joined with `" and "` in the error message
- Whitespace differences in type specifications and descriptions must be normalized (ignored) during comparison
- The function must support selective inclusion and exclusion of items to check:
  - `include_params`/`exclude_params` for Parameters section
  - `include_attrs`/`exclude_attrs` for Attributes section
  - `include_returns`/`exclude_returns` for Returns section
- The `include_*` arguments must accept either a list of specific names to check, `True` to include all items, or `False` to skip checking that section
- The `exclude_*` arguments can only be set when the corresponding `include_*` is `True`
- Items not present in all objects must be skipped with a warning
- When inconsistencies are detected, raise an `AssertionError` with a diff message using the following **word-based context diff format**:
  - **IMPORTANT: Word-based diffing** - Split descriptions into words using `.split()` before comparing, NOT line-based
  - Use `difflib.context_diff()` with `n=8` context words
  - The diff header shows which objects are being compared using `fromfile` and `tofile` parameters: `*** ['func_a']` and `--- ['func_b']`
  - **Group consecutive diff words together** on the same line to shorten output:
    - Words with same diff marker (`  `, `- `, `+ `, `! `) should be joined with spaces
    - Example: Instead of `! set\n! of\n! labels`, output `! set of labels`
  - Implementation approach:
    ```python
    from difflib import context_diff
    from itertools import groupby

    def _diff_key(line):
        """Key for grouping output from context_diff."""
        if line.startswith("  "): return "  "
        elif line.startswith("- "): return "- "
        elif line.startswith("+ "): return "+ "
        elif line.startswith("! "): return "! "
        return None

    def _get_diff_msg(docstrings_grouped):
        msg_diff = ""
        ref_str, ref_group = "", []
        for docstring, group in docstrings_grouped.items():
            if not ref_str:
                ref_str, ref_group = docstring, list(group)
            diff = list(context_diff(
                ref_str.split(), docstring.split(),
                fromfile=str(ref_group), tofile=str(group), n=8
            ))
            msg_diff += "".join(diff[:3])  # header
            for start, grp in groupby(diff[3:], key=_diff_key):
                if start is None:
                    msg_diff += "\n" + "\n".join(grp)
                else:
                    msg_diff += "\n" + start + " ".join(w[2:] for w in grp)
            msg_diff += "\n\n"
        return msg_diff
    ```
- All objects must be one of: function, class, or data descriptor - raise `TypeError` for other types
- The function must require numpydoc for parsing docstrings

**Acceptance**:
- The function signature must be: `assert_docstring_consistency(objects, include_params=False, exclude_params=None, include_attrs=False, exclude_attrs=None, include_returns=False, exclude_returns=None)`
- The `include_*` parameters must accept `list[str]`, `True`, or `False` (default `False`)
- The `exclude_*` parameters must accept `list[str]` or `None` (default `None`)
- When `assert_docstring_consistency` is called with objects having identical parameter descriptions, no error is raised
- When `assert_docstring_consistency` is called with objects having differing parameter descriptions, an `AssertionError` is raised with a message matching regex `r"The description of Parameter '.+' is inconsistent between"`
- When `assert_docstring_consistency` is called with objects having differing type specifications, an `AssertionError` is raised with a message matching regex `r"The type specification of Parameter '.+' is inconsistent between"`
- When `exclude_params` is set but `include_params` is not `True`, a `TypeError` is raised with message matching `"The 'exclude_params' argument"`
- When `exclude_returns` is set but `include_returns` is not `True`, a `TypeError` is raised with message matching `"The 'exclude_returns' argument"`
- When a non-function/class/descriptor object is passed, a `TypeError` is raised with message matching `"All 'objects' must be one of"`
- When a parameter exists in only some objects, a `UserWarning` is issued with message matching regex `r"Checking was skipped for Parameters: \[.+\]"` (skipped items as a Python list, not individual strings)
- The function docstring must include usage examples in numpydoc format for doctest compatibility

---

### FR2: Numpydoc Skip Decorator

**Problem**: Tests requiring the numpydoc package need a consistent way to be skipped when numpydoc is not installed.

**Requirements**:
- Implement a pytest skip marker `skip_if_no_numpydoc` in `sklearn.utils._testing` using `pytest.mark.skipif`
- The marker should check numpydoc availability using a helper function `_is_numpydoc()` that attempts to import numpydoc and returns `True`/`False`
- The marker should skip tests when numpydoc is not available
- The marker should provide a clear skip reason message

**Acceptance**:
- `skip_if_no_numpydoc` must be defined as `pytest.mark.skipif(not _is_numpydoc(), reason="numpydoc is required to test the docstrings")`
- When numpydoc is not installed, tests decorated with `@skip_if_no_numpydoc` are skipped with appropriate message
- When numpydoc is installed, tests decorated with `@skip_if_no_numpydoc` execute normally

---

### FR3: Stacking Estimators Docstring Consistency

**Problem**: `StackingClassifier` and `StackingRegressor` share common parameters and attributes that should have consistent documentation.

**Requirements**:
- The `cv`, `n_jobs`, `passthrough`, and `verbose` parameters must have consistent type specifications and descriptions between `StackingClassifier` and `StackingRegressor`
- Attributes shared between both estimators must have consistent documentation (excluding `final_estimator_` which differs by estimator type)
- A test must verify this consistency using the docstring consistency assertion utility

**Acceptance**:
- When `assert_docstring_consistency` is called with `StackingClassifier` and `StackingRegressor` checking the parameters `cv`, `n_jobs`, `passthrough`, `verbose` and all attributes except `final_estimator_`, no error is raised

---

### FR4: Precision-Recall Metrics Docstring Consistency

**Problem**: Related precision/recall/f-score metric functions share common parameters that should have consistent documentation.

**Requirements**:
- The following functions must have consistent parameter documentation: `precision_recall_fscore_support`, `f1_score`, `fbeta_score`, `precision_score`, `recall_score`
- All shared parameters must have consistent type specifications and descriptions, except `average` and `zero_division` which have function-specific documentation
- A test must verify this consistency using the docstring consistency assertion utility

**Acceptance**:
- When `assert_docstring_consistency` is called with the precision/recall/f-score functions checking all parameters except `average` and `zero_division`, no error is raised

---

### FR5: TunedThresholdClassifierCV Metadata Routing Compatibility

**Problem**: `TunedThresholdClassifierCV` is not covered by the metadata routing compatibility test suite. `TunedThresholdClassifierCV` has a bug where `get_metadata_routing()` fails when called before `fit()` because it accesses an instance attribute that only exists after fitting.

**Requirements**:
- `TunedThresholdClassifierCV` must be compatible with the metadata routing framework
- The estimator must support metadata routing through its sub-estimator during `fit`
- A test must verify metadata routing compatibility using the existing test infrastructure
- **BUG FIX REQUIRED**: In `sklearn/model_selection/_classification_threshold.py`, the `_get_curve_scorer()` method has a bug that must be fixed:
  - **Current bug**: The method uses `self._response_method` which is an instance attribute that only exists after `fit()` is called
  - **Required fix**: Change `self._response_method` to `self._get_response_method()` (method call instead of attribute access)
  - This fix is necessary because `get_metadata_routing()` calls `_get_curve_scorer()` and can be called before `fit()`

**Acceptance**:
- Add an entry to the `METAESTIMATORS` list in `sklearn/tests/test_metaestimators_metadata_routing.py` with the following configuration:
  - `"metaestimator": TunedThresholdClassifierCV`
  - `"estimator_name": "estimator"`
  - `"estimator": "classifier"`
  - `"X": X` (standard test data)
  - `"y": y_binary` (binary classification labels)
  - `"estimator_routing_methods": ["fit"]`
  - `"preserves_metadata": "subset"`
- When `test_default_request[TunedThresholdClassifierCV]` runs, the test must pass
- The estimator must work correctly with classifiers that support metadata routing

---

# Environment Dependency Changes (relative to Base Env)

## Python Packages
- scikit-learn upgraded to 1.6.dev0
