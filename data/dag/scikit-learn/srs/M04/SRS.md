# Software Requirements Specification: M04 - Estimator Validation and Performance Improvements

## Overview

This milestone addresses three distinct improvements to scikit-learn estimators:

1. **FR1**: Deprecate the non-functional `copy` parameter in `Birch` clustering algorithm
2. **FR2**: Enable parallel prediction in `IsolationForest` for improved performance
3. **FR3**: Add missing `force_writeable` parameter in `KernelCenterer.transform()`

**Affected Modules**:
- `sklearn.cluster` (Birch)
- `sklearn.ensemble` (IsolationForest)
- `sklearn.preprocessing` (KernelCenterer)

---

## Requirements

### FR1: Deprecate Birch `copy` Parameter

**Problem**: The `Birch` clustering estimator exposes a `copy` parameter that has no functional effect on the estimator's behavior, as the estimator does not perform in-place operations on the input data.

**Requirements**:
- Deprecate the `copy` parameter of the `Birch` estimator
- When a user explicitly sets the `copy` parameter to any boolean value (`True` or `False`), emit a `FutureWarning` indicating the parameter is deprecated
- The deprecation warning should indicate that the parameter will be removed in version 1.8
- The warning should explain that the parameter has no effect internally
- Change the default value to a sentinel that distinguishes user-provided values from the default
- The warning should only be emitted on the first call to `fit()` or `partial_fit()`, not on subsequent partial fitting operations

**Acceptance**:
- When `Birch(copy=True).fit(X)` is called, a `FutureWarning` is raised with a message containing the substring `` `copy` was deprecated ``
- When `Birch(copy=False).fit(X)` is called, a `FutureWarning` is raised with a message containing the substring `` `copy` was deprecated ``
- When `Birch().fit(X)` is called without specifying `copy`, no warning is raised
- When `partial_fit()` is called multiple times after an initial fit, the warning is not repeated
- The `Birch.__init__()` parameter `copy` must have a default value that is distinguishable from user-provided boolean values (e.g., a sentinel string like `"deprecated"`)

---

### FR2: Enable Parallel Prediction in IsolationForest

**Problem**: The `IsolationForest` estimator performs prediction sequentially over all trees when computing anomaly scores, which becomes a bottleneck for large sample sizes (typically above 1000-2000 samples).

**Requirements**:
- Enable parallel computation of tree depths during prediction in `IsolationForest`
- The parallelization should apply to `score_samples()`, `decision_function()`, and `predict()` methods
- Use a thread-based parallelization approach since the underlying tree operations release the GIL
- Allow users to control parallelism through joblib's `parallel_backend` context manager rather than the class's `n_jobs` parameter (which is reserved for `fit()`)
- Ensure thread-safety when accumulating depth values across parallel workers by using appropriate synchronization
- Require shared memory for parallel workers to enable efficient depth accumulation
- Document the parallelization mechanism in the docstrings of `predict()`, `decision_function()`, and `score_samples()` methods

**Acceptance**:
- When running `IsolationForest.predict()` or `decision_function()` within a `joblib.parallel_backend("threading", n_jobs=N)` context, the computation is parallelized across N workers
- The results from parallel execution are identical to sequential execution
- Parallel prediction produces speedup for sample sizes larger than approximately 2000 samples
- The `n_jobs` parameter of the `IsolationForest` class continues to affect only the `fit()` method, not prediction methods

---

### FR3: Add Missing force_writeable in KernelCenterer.transform

**Problem**: The `KernelCenterer.transform()` method performs in-place modifications on the input kernel matrix but does not request a writeable array during validation, which can lead to errors when the input array is read-only.

**Requirements**:
- Add `force_writeable=True` to the `_validate_data()` call in `KernelCenterer.transform()`
- This ensures the validated array is writeable before performing in-place operations

**Acceptance**:
- When `KernelCenterer.transform()` receives a read-only array, it creates a writeable copy and operates correctly
- The existing behavior of respecting the `copy` parameter is preserved
- In-place modifications on the kernel matrix (subtracting row/column means, adding grand mean) succeed without errors


---

# Environment Dependency Changes (relative to Base Env)

## Python Packages
- scikit-image removed

