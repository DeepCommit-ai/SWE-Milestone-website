# Software Requirements Specification: Metadata Routing for RFE and RFECV

## Overview

This specification defines requirements for implementing SLEP006-compliant metadata routing in the Recursive Feature Elimination (RFE) and RFE with Cross-Validation (RFECV) classes within scikit-learn's feature selection module.

**Summary of Requirements:**
1. FR1: Enable metadata routing for RFE class (fit, predict, score methods)
2. FR2: Enable metadata routing for RFECV class with multi-target routing (estimator, CV splitter, scorer)
3. FR3: Provide proper metadata routing introspection via `get_metadata_routing()` method
4. FR4: Ensure thread-safety when RFECV is used with joblib threading backend
5. FR5: Maintain backward compatibility when metadata routing is disabled

**Affected Module:** `sklearn.feature_selection`

---

## FR1: RFE Metadata Routing Support

**Problem**: The RFE class does not support metadata routing, preventing users from passing sample weights or custom metadata to the underlying estimator's fit, predict, and score methods when metadata routing is enabled.

**User Report**:
```
When using RFE with an estimator that requires sample_weight, there is no way to
pass sample weights through to the underlying estimator when metadata routing is
enabled. The RFE class currently raises an error indicating metadata routing is
not supported.
```

**Requirements**:
- RFE must support routing metadata to the underlying estimator's `fit` method
- RFE must support routing metadata to the underlying estimator's `predict` method
- RFE must support routing metadata to the underlying estimator's `score` method
- When metadata routing is enabled, parameters passed to RFE methods must be properly routed based on the estimator's metadata requests
- The `predict` method must accept optional keyword arguments for metadata when routing is enabled
- The `score` method must properly route score parameters to the underlying estimator

**Acceptance**:
- When RFE is configured with an estimator that requests `sample_weight` for fit, passing `sample_weight` to `RFE.fit()` routes it to the estimator's fit method
- The `RFE.predict()` method signature must accept `**predict_params` for metadata routing when enabled
- The `RFE.score()` method signature must accept `**score_params` for metadata routing when enabled
- When metadata routing is enabled and an estimator requests metadata for predict, calling `RFE.predict(X, **predict_params)` routes parameters to the estimator's predict method
- When metadata routing is enabled and score parameters are passed to `RFE.score()`, they are routed to the estimator's score method
- Passing unrequested metadata raises `UnsetMetadataPassedError` with a descriptive message

---

## FR2: RFECV Multi-Target Metadata Routing Support

**Problem**: The RFECV class does not support metadata routing to its three internal components: the underlying estimator, the cross-validation splitter, and the scorer. This prevents users from passing groups to CV splitters or sample weights to scorers.

**User Report**:
```
RFECV uses cross-validation internally but there's no way to pass groups to a
GroupKFold splitter when using RFECV. Similarly, custom scorers that accept
sample_weight cannot receive weights during cross-validation scoring.
```

**Requirements**:
- RFECV must route metadata to the underlying estimator's `fit` method
- RFECV must route metadata to the CV splitter's `split` method (including groups)
- RFECV must route metadata to the scorer's `score` method during cross-validation
- RFECV must route metadata to the scorer's `score` method when calling `RFECV.score()`
- The `groups` parameter in `RFECV.fit()` must continue to work and be routed appropriately
- When metadata routing is enabled, additional parameters can be passed via `**params` in fit
- RFECV must implement its own `score` method that uses the configured scorer and routes parameters appropriately
- When routing array-like metadata (e.g., `sample_weight`) during cross-validation, the metadata must be properly indexed to match train/test split indices. Reference the pattern used in `sklearn/model_selection/_validation.py::_fit_and_score` (see comment "Adjust length of sample weights")

**Acceptance**:
- The `RFECV.fit()` method signature must accept `**params` in addition to the `groups` parameter for metadata routing when enabled
- When RFECV is used with a GroupKFold splitter and `groups` is passed to fit, the groups are routed to the splitter's split method
- When RFECV is used with a scorer that requests `sample_weight`, passing `sample_weight` to fit routes it to the scorer during cross-validation
- RFECV must implement a `score(self, X, y, **score_params)` method that uses the configured scorer (from `self.scoring`) and routes `**score_params` to the scorer
- When calling `RFECV.score(X, y, **score_params)`, parameters are routed to the configured scorer
- RFECV can be used within `cross_validate` with a group splitter without raising "groups parameter should not be None" errors
- Passing metadata without setting appropriate requests raises `UnsetMetadataPassedError`

---

## FR3: Metadata Routing Introspection

**Problem**: RFE and RFECV do not provide a `get_metadata_routing()` method, preventing users and meta-estimators from inspecting their routing configuration.

**Requirements**:
- RFE must implement `get_metadata_routing()` returning a `MetadataRouter` instance
- The RFE router must declare routing for estimator with method mappings: fit→fit, predict→predict, score→score
- RFECV must implement `get_metadata_routing()` returning a `MetadataRouter` instance
- The RFECV router must declare routing for estimator (fit→fit), splitter (fit→split), and scorer (fit→score, score→score)
- The routing configuration must accurately reflect which methods can receive metadata

**Acceptance**:
- Calling `RFE(...).get_metadata_routing()` returns a `MetadataRouter` instance (from `sklearn.utils.metadata_routing`)
- Calling `RFECV(...).get_metadata_routing()` returns a `MetadataRouter` instance
- The RFE router must add the estimator using `router.add(estimator=..., method_mapping=...)` with the method mappings specified above
- The RFECV router must add three sub-objects with names `"estimator"`, `"splitter"`, and `"scorer"` using `router.add(...)`
- The returned routers have empty requests by default (aside from group splitters which request groups by default)
- The routing information is correct and usable by meta-estimators that need to inspect routing

---

## FR4: RFECV Thread-Safety with joblib Threading Backend

**Problem**: RFECV produces inconsistent results when using the joblib threading backend. Running the same RFECV fit operation with threading produces different feature rankings than with the default backend.

**User Report**:
```
When using RFECV with n_jobs > 1 and the threading backend, the feature rankings
differ from runs using the default loky backend. This makes results non-reproducible
when the threading backend is used.
```

**Requirements**:
- RFECV must produce consistent feature rankings regardless of which joblib backend is used
- The internal RFE objects used in parallel cross-validation folds must not share mutable state
- Each parallel worker must operate on an independent copy of the RFE object (using `clone()` from `sklearn.base`)

**Acceptance**:
- When RFECV is fit with the default backend and then fit again with `parallel_backend("threading")`, the resulting feature rankings are identical
- Running RFECV with `n_jobs > 1` produces deterministic results with both loky and threading backends
- The parallel loop in RFECV must use `clone(rfe)` to create independent RFE instances for each fold

---

## FR5: Backward Compatibility

**Problem**: Existing code using RFE and RFECV must continue to work when metadata routing is disabled (the default).

**Requirements**:
- When `enable_metadata_routing=False` (default), RFE.fit() must continue to pass `**fit_params` directly to the estimator's fit method as before
- When `enable_metadata_routing=False`, RFECV.fit() must continue to handle the `groups` parameter via the existing signature
- When `enable_metadata_routing=False`, RFE.score() must continue to pass score parameters directly to the estimator
- No existing public API signatures should break when metadata routing is disabled
- The `groups` parameter in RFECV.fit() must remain functional in both routing and non-routing modes

**Acceptance**:
- Existing code using `RFE.fit(X, y, sample_weight=sw)` continues to work when metadata routing is disabled
- Existing code using `RFECV.fit(X, y, groups=g)` continues to work when metadata routing is disabled
- The default behavior (routing disabled) matches the pre-implementation behavior exactly


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
