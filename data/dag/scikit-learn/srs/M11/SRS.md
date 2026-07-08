# Software Requirements Specification: Missing Value Support for ExtraTree Estimators

## Overview

This specification defines the requirements for adding native missing value (NaN) support to ExtraTreeClassifier and ExtraTreeRegressor estimators. Currently, DecisionTree estimators with the "best" splitter support missing values, but ExtraTree estimators using the "random" splitter do not handle NaN values in input data.

### Requirements Summary

1. **FR1**: Enable ExtraTreeClassifier to accept and process datasets containing NaN values during training and prediction
2. **FR2**: Enable ExtraTreeRegressor to accept and process datasets containing NaN values during training and prediction
3. **FR3**: Implement missing value partitioning logic for the random splitter algorithm
4. **FR4**: Enable IsolationForest to handle missing values (as it uses ExtraTree estimators internally)

### Affected Modules

- `sklearn.tree` (ExtraTreeClassifier, ExtraTreeRegressor, DecisionTreeClassifier, DecisionTreeRegressor)
- `sklearn.ensemble` (IsolationForest)
- Tree splitter implementation (random splitter algorithm)
- Dense partitioner for feature value handling

---

## Functional Requirements

### FR1: ExtraTreeClassifier Missing Value Support

**Problem**: ExtraTreeClassifier raises an error when fitting or predicting on datasets containing NaN values, despite this being a common occurrence in real-world data.

**Requirements**:
- ExtraTreeClassifier shall accept input arrays containing NaN (missing) values during fit
- ExtraTreeClassifier shall accept input arrays containing NaN values during predict
- Missing value support shall be available for the following criteria: "gini", "entropy", "log_loss"
- The estimator's tags shall correctly indicate NaN support when using the "random" splitter with supported criteria

**Acceptance**:
- When fitting ExtraTreeClassifier on a dataset with NaN values using criterion "gini", "entropy", or "log_loss", training completes without error
- When predicting with ExtraTreeClassifier on samples containing NaN values, predictions are returned without error
- The `_more_tags()` method must return `allow_nan=True` when `self.splitter in ("best", "random")` and `self.criterion in {"gini", "log_loss", "entropy"}`

---

### FR2: ExtraTreeRegressor Missing Value Support

**Problem**: ExtraTreeRegressor raises an error when fitting or predicting on datasets containing NaN values.

**Requirements**:
- ExtraTreeRegressor shall accept input arrays containing NaN (missing) values during fit
- ExtraTreeRegressor shall accept input arrays containing NaN values during predict
- Missing value support shall be available for the following criteria: "squared_error", "friedman_mse", "poisson"
- The "absolute_error" criterion shall continue to reject datasets with missing values (not supported)
- The estimator's tags shall correctly indicate NaN support when using the "random" splitter with supported criteria

**Acceptance**:
- When fitting ExtraTreeRegressor on a dataset with NaN values using criterion "squared_error", "friedman_mse", or "poisson", training completes without error
- When predicting with ExtraTreeRegressor on samples containing NaN values, predictions are returned without error
- When attempting to fit ExtraTreeRegressor with criterion "absolute_error" on data containing NaN, a ValueError is raised with message "Input X contains NaN"
- The `_more_tags()` method must return `allow_nan=True` when `self.splitter in ("best", "random")` and `self.criterion in {"squared_error", "friedman_mse", "poisson"}`

---

### FR3: Random Splitter Missing Value Handling Algorithm

**Problem**: The random splitter algorithm used by ExtraTree estimators does not account for missing values when selecting split thresholds and partitioning samples.

**Requirements**:
- During node splitting, samples with missing values shall be identified and separated from non-missing samples for each candidate feature
- When computing the min/max feature value range for threshold selection, missing values shall be excluded from the calculation
- Features where all non-missing values are constant (or all values are missing) shall be treated as constant features and not considered for splitting
- When missing values are present in the training data for a feature, they shall be randomly assigned to either the left or right child node
- When no missing values are present in the training data for a feature, missing values at prediction time shall be sent to the child node that contains more training samples
- The impurity computation shall correctly account for the number of missing values assigned to each child node
- The min_samples_leaf constraint shall be correctly enforced considering the assignment of missing values to child nodes

**Acceptance**:
- When fitting ExtraTreeRegressor on data with NaN values, the resulting tree must have non-negative impurity values at all nodes (i.e., `tree.tree_.impurity >= 0` for all nodes)
- When fitting ExtraTreeRegressor on data with NaN values, leaf nodes containing a single sample must have zero impurity (i.e., `tree.tree_.impurity[leaves_idx] == 0.0` where `leaves_idx` are indices of single-sample leaves)
- When a sample with NaN values is predicted using ExtraTreeRegressor trained on data without NaN in that feature, the sample is routed to the child node with more training samples (determined by `tree_.weighted_n_node_samples`)
- The random splitter algorithm must correctly reinitialize the criterion's missing value count between features to ensure correct impurity calculations

---

### FR4: IsolationForest Missing Value Support

**Problem**: IsolationForest, which internally uses ExtraTree estimators, does not accept datasets with missing values.

**Requirements**:
- IsolationForest shall accept input arrays containing NaN values during fit
- IsolationForest shall accept input arrays containing NaN values during score_samples and predict methods
- Input validation shall allow non-finite values (NaN) to pass through without raising an error
- The estimator's tags shall indicate NaN support

**Acceptance**:
- When fitting IsolationForest on a dataset containing NaN values, training completes without error
- When calling score_samples on data containing NaN values, scores are returned without error
- When calling predict on data containing NaN values, predictions are returned without error
- `IsolationForest._validate_data()` must be called with `force_all_finite=False` during both `fit()` and `score_samples()` to allow NaN values
- The `_more_tags()` method must return `allow_nan=True`

---

## Test Acceptance Criteria

The implementation shall pass the following test scenarios:

1. **Regression tree with missing values (toy dataset)**: ExtraTreeRegressor trained on small arrays with NaN values in various positions produces trees with non-negative impurity and zero impurity at single-sample leaves

2. **Missing value resilience**: ExtraTreeClassifier and ExtraTreeRegressor achieve comparable or better performance than a pipeline with SimpleImputer followed by the same tree type, when trained on datasets with 10% missing values

3. **Prediction routing for missing values (no training NaN)**: When ExtraTreeRegressor is trained on data without NaN values, prediction samples with NaN are routed to the child node containing more training samples

4. **Poisson criterion with missing values**: ExtraTreeRegressor with criterion "poisson" fits successfully on data with missing values and produces non-negative predictions

5. **Predictive missing values**: ExtraTreeClassifier can learn patterns where the presence/absence of missing values is itself predictive of the target class

6. **Unsupported configuration errors**: ExtraTreeRegressor with criterion "absolute_error" correctly rejects data containing NaN values


---

# Environment Dependency Changes (relative to Base Env)

## Python Packages
- alabaster 1.0.0 added
- babel 2.17.0 added
- black 25.12.0 added
- certifi 2026.1.4 added
- charset-normalizer 3.4.4 added
- click 8.3.1 added
- contourpy 1.3.3 added
- coverage 7.13.1 added
- cycler 0.12.1 added
- Cython 3.2.4 added
- docutils 0.22.4 added
- execnet 2.1.2 added
- fonttools 4.61.1 added
- idna 3.11 added
- imageio 2.37.2 added
- imagesize 1.4.1 added
- iniconfig 2.3.0 added
- Jinja2 3.1.6 added
- joblib 1.5.3 added
- kiwisolver 1.4.9 added
- lazy_loader 0.4 added
- librt 0.7.8 added
- MarkupSafe 3.0.3 added
- matplotlib 3.10.8 added
- meson 1.10.0 added
- meson-python 0.18.0 added
- mypy 1.19.1 added
- mypy_extensions 1.1.0 added
- networkx 3.6.1 added
- numpy 2.4.1 added
- numpydoc 1.10.0 added
- packaging 25.0 added
- pandas 2.3.3 added
- pathspec 1.0.3 added
- pillow 12.1.0 added
- pip 24.0 added
- platformdirs 4.5.1 added
- pluggy 1.6.0 added
- polars 1.37.1 added
- polars-runtime-32 1.37.1 added
- pooch 1.8.2 added
- pyamg 5.3.0 added
- pyarrow 22.0.0 added
- Pygments 2.19.2 added
- pyparsing 3.3.1 added
- pyproject-metadata 0.10.0 added
- pytest 9.0.2 added
- pytest-cov 7.0.0 added
- pytest-json-report 1.5.0 added
- pytest-metadata 3.1.1 added
- pytest-timeout 2.4.0 added
- pytest-xdist 3.8.0 added
- python-dateutil 2.9.0.post0 added
- pytokens 0.3.0 added
- pytz 2025.2 added
- requests 2.32.5 added
- roman-numerals 4.1.0 added
- ruff 0.14.11 added
- scikit-image 0.26.0 added
- scikit-learn 1.6.dev0 added
- scipy 1.17.0 added
- setuptools 79.0.1 added
- six 1.17.0 added
- snowballstemmer 3.0.1 added
- Sphinx 9.0.4 added
- sphinxcontrib-applehelp 2.0.0 added
- sphinxcontrib-devhelp 2.0.0 added
- sphinxcontrib-htmlhelp 2.1.0 added
- sphinxcontrib-jsmath 1.0.1 added
- sphinxcontrib-qthelp 2.0.0 added
- sphinxcontrib-serializinghtml 2.0.0 added
- threadpoolctl 3.6.0 added
- tifffile 2026.1.14 added
- typing_extensions 4.15.0 added
- tzdata 2025.3 added
- urllib3 2.6.3 added
- wheel 0.45.1 added
