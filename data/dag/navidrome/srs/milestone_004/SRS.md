# Software Requirements Specification: Scanner Quality Improvements

## Overview

This milestone addresses several scanner quality improvements related to audio file metadata extraction and database integrity:

1. **FR1**: Add cover art extraction support for DSF, WavPack (.wv), and WMA audio formats
2. **FR2**: Fix WMA multi-value tag parsing to correctly read all tag values
3. **FR3**: Fix misleading warning messages for empty custom tag split configuration
4. **FR4**: Prevent foreign key constraint errors when inserting album participants with invalid artist references

**Affected Modules**:
- TagLib wrapper (C++ audio metadata extraction layer)
- Tag mappings configuration processing
- Album persistence layer (participant insertion)

---

## FR1: Cover Art Extraction for Additional Audio Formats

**Problem**: The scanner does not detect embedded cover art in DSF (DSD Stream File), WavPack (.wv), and WMA audio files, causing albums using these formats to appear without artwork even when cover images are embedded in the files.

**Requirements**:
- Extend cover art detection to support DSF files that contain ID3v2 tags with embedded APIC (Attached Picture) frames
  - Note: In TagLib, DSF::File exposes ID3v2 tags directly via the `tag()` method (unlike WAV/AIFF which have separate `hasID3v2Tag()`/`ID3v2Tag()` methods)
- Extend cover art detection to support WavPack files that contain APE tags with embedded cover art (using the standard "COVER ART (FRONT)" item key used by tagging applications like MusicBrainz Picard)
- Ensure WMA cover art detection correctly accesses the tag's attribute list map

**Acceptance**:
- When scanning a DSF file with an embedded cover image in its ID3v2 tag, the scanner reports the file has cover art
- When scanning a WavPack (.wv) file with an embedded cover image in its APE tag, the scanner reports the file has cover art
- When scanning a WMA file with an embedded WM/Picture attribute, the scanner reports the file has cover art

---

## FR2: WMA Multi-Value Tag Parsing

**Problem**: WMA (ASF) files with multi-value tags only have the first value read. When a WMA file contains multiple values for the same tag (e.g., multiple artists, composers, or performers), only the first value is extracted, losing important metadata.

**Requirements**:
- When parsing WMA/ASF files, iterate through all values in each attribute's list rather than only reading the first value
- Ensure all tag values are correctly passed to the metadata processing layer

**Acceptance**:
- When parsing a WMA file with multiple values for a tag (e.g., multiple composers or performers), all values are extracted and populated into the `Participants` map keyed by role
- The participant data for each role is accessed via `Participants[role]`, returning a list of participants for that role
- Note: WMA format may not support all roles (e.g., Arranger role is not available in WMA files and returns an empty list)

---

## FR3: Misleading Custom Tag Split Configuration Warning

**Problem**: The log displays a warning message "No valid separators found in split list" even when no split separators were configured for a tag. This creates confusion for users who haven't configured any tag splitting, as they see warnings about missing separators for tags where splitting was never intended.

**Requirements**:
- Only display the "No valid separators found" warning when the user has actually configured a split list that contains values but none of them are valid
- When the split list is empty or not configured, do not display any warning
- Adjust log severity for split regex compilation errors from error to warning level

**Acceptance**:
- When a tag has no split configuration (empty split list), no warning is logged during startup or scanning
- When a tag has a split configuration with only invalid/empty separators, a warning is logged indicating no valid separators were found
- When a tag has valid separators configured, the split regex is compiled without warnings

---

## FR4: Album Participant Foreign Key Constraint Errors

**Problem**: When saving an album with participant information, foreign key constraint errors occur if the participant list contains artist IDs that do not exist in the artist table. This can happen in various edge cases during library scanning and causes the album save operation to fail.

**User Report**:
```
FOREIGN KEY constraint failed when inserting album participants.
The album contains references to artist IDs that were not found in the database,
causing the insertion to fail and preventing the album from being properly indexed.
```

**Requirements**:
- When inserting album participant records into the `album_artists` junction table, automatically filter out any participant entries that reference non-existent artist IDs
- Only insert participant records for artists that actually exist in the database
- The filtering mechanism should ensure only participant entries with valid artist IDs (matching existing artist records) are inserted
- The filtering must happen silently without causing errors or warnings
- Valid participant entries should still be inserted even when invalid entries are present in the same batch

**Acceptance**:
- When an album has participants with only valid artist IDs, all participant records are inserted correctly
- When an album has participants with only non-existent artist IDs, no participant records are inserted and no error occurs
- When an album has a mix of valid and invalid artist IDs, only the valid participant records are inserted
- When an album has complex participant structures with multiple roles and sub-roles, all valid entries are correctly inserted


---

# Environment Dependency Changes (relative to Base Env)

## Go Packages
- go upgraded to 1.24.5
- github.com/onsi/ginkgo/v2/ginkgo v2.27.4 added (Ginkgo CLI)
