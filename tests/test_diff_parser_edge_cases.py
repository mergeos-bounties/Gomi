"""Regression tests for unified diff parser edge cases."""

import pytest
from gomi.parser import parse_diff

def test_empty_diff():
    """Test parsing empty diff."""
    result = parse_diff("")
    assert result.files == []

def test_single_file_add():
    """Test parsing single file addition."""
    diff = """--- /dev/null
+++ b/new_file.txt
@@ -0,0 +1,3 @@
+line1
+line2
+line3"""
    result = parse_diff(diff)
    assert len(result.files) == 1
    assert result.files[0].path == "new_file.txt"

def test_multiple_files():
    """Test parsing multiple files."""
    diff = """--- a/file1.txt
+++ b/file1.txt
@@ -1 +1 @@
-old
+new
--- a/file2.txt
+++ b/file2.txt
@@ -1 +1 @@
-old2
+new2"""
    result = parse_diff(diff)
    assert len(result.files) == 2

def test_binary_file():
    """Test parsing binary file change."""
    diff = """Binary files a/image.png and b/image.png differ"""
    result = parse_diff(diff)
    assert len(result.files) == 1
    assert result.files[0].is_binary

def test_rename_detection():
    """Test parsing file rename."""
    diff = """diff --git a/old.txt b/new.txt
similarity index 100%
rename from old.txt
rename to new.txt"""
    result = parse_diff(diff)
    assert len(result.files) == 1
    assert result.files[0].renamed_from == "old.txt"
