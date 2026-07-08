# Software Requirements Specification: Mapping and Unmarshaler Improvements

## Overview

This milestone addresses multiple issues in the mapping/unmarshaler subsystem, including:

1. **FR1**: Negative float32 overflow detection during unmarshalling
2. **FR2**: Panic prevention when filling slice values with nil elements
3. **FR3**: Support for json.Unmarshaler interface in struct fields
4. **FR4**: Duration type handling improvements for numeric and pointer values
5. **FR5**: FillDefault optional field handling fix
6. **FR6**: Base64-encoded []byte field handling in JSON parsing
7. **FR7**: Array marshaling validation fix
8. **FR8**: Environment variable unmarshaling for custom string types
9. **FR9**: Float pointer overflow checking improvements

**Affected Modules**:
- `core/mapping/unmarshaler.go`
- `core/mapping/marshaler.go`
- `core/mapping/utils.go`

---

## Requirements

### FR1: Negative Float32 Overflow Detection

**Problem**: Unmarshalling negative float values that exceed float32 range does not properly report overflow errors.

**User Report**:
```
When unmarshalling a negative float value like "-1.79769313486231570814527423731704356798070e+300"
into a float32 field, no overflow error is returned. The previous implementation only checked
if the value exceeds math.MaxFloat32, ignoring negative overflow.
```

**Requirements**:
- Detect overflow for both positive and negative float values when unmarshalling to float32 fields
- Return an appropriate error message when a float value exceeds the valid float32 range in either direction
- The overflow detection must use reflect package's float overflow detection mechanism

**Acceptance**:
- When unmarshalling `"-1.79769313486231570814527423731704356798070e+300"` (a negative value beyond float32 range) to a float32 field, an overflow error is returned
- When unmarshalling valid negative float32 values, no error occurs
- When unmarshalling values that exceed positive float32 range, an overflow error is returned

---

### FR2: Panic Prevention for Nil Slice Elements

**Problem**: The unmarshaler panics when encountering nil elements while filling slice values from JSON arrays.

**User Report**:
```
When parsing a JSON array containing null elements like `[null, 2]` into an int slice,
the unmarshaler panics instead of returning a proper error.
```

**Requirements**:
- Check for nil values before attempting to fill slice elements
- Return a specific error when a null element is encountered in a JSON array being unmarshalled to a typed slice
- The error message should clearly indicate that null elements are not supported for the slice type

**Acceptance**:
- The error must be defined as an unexported package-level sentinel error variable named `errNilSliceElement` in the `core/mapping` package
- When unmarshalling `[null, 2]` into an `[]int8` field, `errNilSliceElement` is returned instead of a panic
- Valid slice data without null elements continues to unmarshal correctly

---

### FR3: Support for json.Unmarshaler Interface in Struct Fields

**Problem**: Struct fields that implement the `json.Unmarshaler` interface are not properly handled during HTTP request parsing.

**User Report**:
```
When parsing an HTTP request body where a struct field implements json.Unmarshaler,
the custom UnmarshalJSON method is not called. The field value comes as a raw string
instead of being properly unmarshalled.
```

**Requirements**:
- Detect when a struct field type implements the `json.Unmarshaler` interface
- When the input value is a string and the target field type is a struct that implements json.Unmarshaler, invoke the custom deserialization method
- The implementation should only apply to fields tagged with the `json` key, not other tag types
- Support both pointer and non-pointer struct types that implement the interface

**Acceptance**:
- When a struct field of type `*CustomType` (where `CustomType` implements `json.Unmarshaler`) receives a string value, the `UnmarshalJSON` method is called with the string value converted directly to `[]byte`
- The unmarshalled result is correctly set on the struct field
- Non-json tagged fields do not trigger the Unmarshaler interface logic

---

### FR4: Duration Type Handling Improvements

**Problem**: The time.Duration type causes panics when receiving numeric values instead of string values, and pointer types for duration fail with environment variables.

**User Report**:
```
1. When JSON contains `{"duration": 1}` (numeric) instead of `{"duration": "1s"}` (string)
   for a time.Duration field, the system panics with a type assertion error.

2. When using environment variables with a *time.Duration field, unmarshalling fails
   because the code compares field.Kind() (which is Ptr) against durationType.Kind() (which is Int64).
```

**Requirements**:
- Add type assertion safety when processing duration values to prevent panics on type mismatches
- Return a descriptive error when a non-string value is provided for a duration field
- Fix duration type comparison in environment variable processing to handle pointer types correctly
- Compare the dereferenced field type against durationType, not the field kind

**Acceptance**:
- When unmarshalling `{"duration": 1}` (numeric) to a `time.Duration` field, an error message is returned containing "unexpected type"
- When using an environment variable like `TEST_DURATION=1s` with a `*time.Duration` field, unmarshalling succeeds
- String duration values like `"1s"` continue to work correctly for both value and pointer types

---

### FR5: FillDefault Optional Field Handling Fix

**Problem**: When using `FillDefault` option, fields with `optional=!OtherField` syntax cause errors even when the condition should be ignored.

**User Report**:
```
Using a struct like:
type St struct {
    A string `json:",optional"`
    B string `json:",optional=!A"`
}
When filling defaults with an empty map, an error occurs because the optional condition
is evaluated even though it should be skipped during default filling.
```

**Requirements**:
- When the `fillDefault` option is enabled on the unmarshaler, skip the evaluation of optional field conditions
- Return early from options processing when filling defaults, before attempting to resolve optional conditions
- Normal unmarshalling (without fillDefault) should continue to evaluate optional conditions as before

**Acceptance**:
- When using `FillDefault` unmarshaler with a struct containing `optional=!FieldName` syntax, no error occurs
- Default values are properly filled for all fields
- Normal unmarshalling still validates optional conditions

---

### FR6: Base64-Encoded []byte Field Handling

**Problem**: When parsing HTTP request bodies containing `[]byte` fields, the base64-encoded string values are not properly decoded.

**User Report**:
```
When a struct has a field like `Signature []byte`, and the JSON body contains the
base64-encoded value (as per Go's standard json.Marshal behavior for []byte),
the ParseJsonBody function fails to decode it back to bytes.
```

**Requirements**:
- When field type is a byte slice and input is a string, attempt base64 decoding
- Detect byte slice type via reflection (slice of uint8 elements)
- If base64 decoding succeeds, set the decoded bytes as the field value
- If base64 decoding fails, fall back to the normal slice-from-string processing
- Handle []byte fields in both the main field processing path and the TextUnmarshaler processing path
- Base64 decoding path checked before generic slice processing

**Acceptance**:
- When unmarshalling `{"signature": "Af8A"}` (base64 for `[]byte{0x01, 0xff, 0x00}`) to a `[]byte` field, the correct bytes are set
- Round-trip marshalling and unmarshalling of `[]byte` fields preserves the original data
- Non-base64 string values for non-[]byte slices continue to work as before

---

### FR7: Array Marshaling Validation Fix

**Problem**: The marshaler incorrectly validates array types as empty when they should be valid.

**User Report**:
```
When marshaling a struct with an array field like `H [1]int`, the validation fails
with "field is empty" error. This happens because arrays were grouped with slices
in the validation logic, but arrays cannot be nil and should not use IsNil() check.
```

**Requirements**:
- Separate array type handling from slice handling in the marshaler validation
- Arrays should not be checked for nil or empty status since they always have a fixed size
- Slices and maps should continue to be validated for nil/empty conditions

**Acceptance**:
- When marshaling a struct with `H [1]int{1}` field, marshaling succeeds without errors
- The marshaled output contains the correct string representation of the array
- Nil slices and empty maps continue to trigger validation errors as expected

---

### FR8: Environment Variable Unmarshaling for Custom String Types

**Problem**: When unmarshalling environment variables to custom string types (type aliases), the value conversion fails.

**User Report**:
```
Using a custom type like:
type Env string
type Config struct {
    Env Env `json:",env=STRING_ENV,default=prod"`
}
When STRING_ENV is set, unmarshalling fails because the code tries to use SetString
directly instead of converting the value to the custom type.
```

**Requirements**:
- When processing environment variable values, properly convert values to the target type (including type aliases)
- Support pointer types for custom string, bool, and numeric types
- Use value conversion via reflect to ensure type compatibility
- Handle string, bool, and duration types as special cases before falling back to JSON number processing

**Acceptance**:
- When unmarshalling with `Env` type (alias for string) and env var set, the correct typed value is set
- When unmarshalling with `*Env` (pointer to type alias) and env var set, the pointer is properly initialized and set
- Custom bool types (e.g., `type Flag bool`) work correctly with environment variables
- Custom numeric types work correctly with environment variables

---

### FR9: Float Pointer Overflow Checking

**Problem**: When unmarshalling float values to pointer types (`*float32`, `**float32`), overflow checking fails because it attempts to call `OverflowFloat` on a pointer type.

**User Report**:
```
When parsing `{"weightFloat32": 3.2}` to a struct with `WeightFloat32 *float32`,
the overflow check fails or panics because the overflow detection cannot be called
on a pointer type - it must be called on the dereferenced float value.
```

**Requirements**:
- Before checking for float overflow, dereference pointer types to get the underlying float value
- Support multiple levels of pointer indirection (e.g., `**float32`)
- Only call overflow detection when the dereferenced value is actually a float type

**Acceptance**:
- When unmarshalling `3.2` to a `*float32` field, the value is correctly set without errors
- When unmarshalling `3.2` to a `**float32` field, the value is correctly set without errors
- When unmarshalling an overflow value to a pointer float field, the appropriate overflow error is returned

---

# Environment Dependency Changes (relative to Base Env)

## Go Runtime
- Go upgraded to 1.21.13 (from 1.19.13)

## Go Packages
- github.com/go-redis/redis/v8 v8.11.5 added
- github.com/golang/mock/gomock v1.6.0 added
- github.com/olekukonko/tablewriter v0.0.5 added
- go.mongodb.org/mongo-driver upgraded to v1.17.1

## Environment Variables
- GOROOT set to /usr/local/go
