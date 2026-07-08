# Software Requirements Specification: Performance Optimizations (M17)

## Overview

This milestone collects performance optimizations across scikit-learn, targeting computational efficiency improvements in three areas:

1. **FR1: Memory-efficient sparse matrix construction in manifold learning** - Reduce memory allocation overhead in Locally Linear Embedding (LLE) for Hessian, Modified, and LTSA methods when using sparse solvers
2. **FR2: Covariance estimation speedup** - Improve MinCovDet fitting performance by optimizing support selection operations
3. **FR3: Classification metrics speedup via label caching** - Reduce redundant unique value computations in classification metrics by caching and reusing unique labels

**Affected Modules**:
- `sklearn.manifold` (Locally Linear Embedding)
- `sklearn.covariance` (Minimum Covariance Determinant)
- `sklearn.metrics` (classification metrics)
- `sklearn.utils` (multiclass utilities, array API utilities)

---

## FR1: Memory-Efficient Sparse Matrix Construction in Manifold Learning

**Problem**: When using Locally Linear Embedding with Hessian, Modified, or LTSA methods and sparse eigen solvers, the algorithm allocates dense N×N matrices upfront and converts them to sparse format only at the end, consuming excessive memory for large datasets.

**Requirements**:
- The LLE implementation for Hessian, Modified, and LTSA methods shall use memory-efficient sparse matrix construction when a sparse eigen solver is selected
- Sparse matrix construction shall be incremental, building the matrix in a format optimized for element-wise insertion rather than allocating a full dense matrix
- The final sparse matrix shall be converted to CSR format before passing to the eigen solver
- The standard LLE method shall continue to work correctly with sparse matrices
- All existing LLE functionality and numerical results shall be preserved

**Acceptance**:
- When `locally_linear_embedding` is called with `method='hessian'`, `method='modified'`, or `method='ltsa'` and `eigen_solver='arpack'` (sparse solver), peak memory usage is reduced compared to dense N×N allocation
- When `locally_linear_embedding` is called with `method='standard'`, existing behavior is preserved
- All existing LLE tests pass without modification
- Numerical results remain identical to the previous implementation

---

## FR2: MinCovDet Fitting Performance Improvement

**Problem**: The MinCovDet estimator's C-step procedure uses full array sorting (`np.argsort`) to select the n_support smallest Mahalanobis distances, which is computationally inefficient when only the smallest values are needed.

**Requirements**:
- The C-step procedure in MinCovDet shall use partial sorting to select the n_support samples with smallest distances instead of full sorting
- The support mask output format (boolean array) shall remain unchanged for API compatibility
- Internally, the algorithm may use index-based support tracking for efficiency, converting to boolean mask format at the final step
- The fitting results shall be numerically equivalent to the previous implementation

**Acceptance**:
- When `MinCovDet.fit()` is called, the fitting procedure completes faster on datasets where n_support is significantly smaller than n_samples
- The output attributes `support_`, `location_`, `covariance_`, and `precision_` are identical to the previous implementation for the same random state
- All existing MinCovDet tests pass without modification

---

## FR3: Classification Metrics Speedup via Unique Label Caching

**Problem**: Classification metric functions (e.g., `classification_report`, `confusion_matrix`, `accuracy_score`) repeatedly compute unique values of `y_true` and `y_pred` arrays through multiple nested function calls. For large arrays, this redundant computation significantly impacts performance.

**Requirements**:
- A mechanism shall be implemented to cache unique values of arrays and retrieve them efficiently in subsequent calls
- The caching mechanism shall attach unique values to NumPy arrays via dtype metadata (using the key `"unique"`), creating a view of the original array
- A utility function `attach_unique(*ys, return_tuple=False)` shall be provided in module `sklearn.utils._unique` to attach unique values to one or more arrays
- A utility function `cached_unique(*ys, xp=None)` shall be provided in module `sklearn.utils._unique` to retrieve cached unique values, falling back to computing unique values if not cached
- The caching utilities shall handle non-NumPy array inputs gracefully (passing them through unchanged)
- The caching utilities shall avoid recalculating unique values if they are already attached
- Classification metric functions shall use the caching mechanism to avoid redundant unique computations
- The multiclass utility functions (`unique_labels`, `type_of_target`, `is_multilabel`) shall use the caching mechanism
- The caching mechanism shall be compatible with array API namespaces (via the `xp` parameter)

**Acceptance**:
- `attach_unique(*ys, return_tuple=False)` must be importable from `sklearn.utils._unique`
- `cached_unique(*ys, xp=None)` must be importable from `sklearn.utils._unique`
- When `attach_unique` is called with a NumPy array, it returns a view (result's `.base` is the original array) with unique values stored in `dtype.metadata["unique"]`
- When `attach_unique` is called with a non-NumPy array (e.g., list), it returns the input unchanged (same object identity)
- When `attach_unique` is called with an array that already has `"unique"` in `dtype.metadata`, it returns the array without recalculating
- When `attach_unique` is called with `return_tuple=True`, it always returns a tuple even for single inputs
- When `attach_unique` is called with multiple arrays, it returns a tuple of results
- When `cached_unique` is called with an array containing `dtype.metadata["unique"]`, it returns the cached unique values without recomputation
- When `cached_unique` is called with an array without cached metadata, it computes and returns unique values
- When `cached_unique` is called with a single array, it returns a single array (not tuple); when called with multiple arrays, it returns a tuple
- When `check_array` is applied to an array with unique metadata, the metadata is preserved
- When `classification_report` or other classification metrics are called with large arrays, execution time is reduced due to caching
- All existing classification metrics tests pass without modification
- The utility functions `attach_unique` and `cached_unique` have proper docstrings conforming to numpydoc/scikit-learn standards (including Parameters and Returns sections)
- **IMPORTANT: Public Module Export for Docstring Tests**: The scikit-learn docstring test framework (`test_function_docstring`) uses `all_functions()` from `sklearn.utils.discovery` to discover functions. This discovery mechanism **skips private modules** where `"._"` appears in the module path. Therefore:
  - Functions defined in `sklearn.utils._unique` will NOT be discovered by docstring tests
  - To be tested by `test_function_docstring`, `attach_unique` and `cached_unique` must be re-exported (imported and made available) from a public module (e.g., `sklearn.utils.multiclass` or another module without `"._"` in its path)
  - The functions should be importable via both the private path (`sklearn.utils._unique.attach_unique`) and a public path for test discovery


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
