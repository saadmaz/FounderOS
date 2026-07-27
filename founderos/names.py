"""Defined-name helpers for scalable, non-volatile dropdown sources.

Every dropdown in the workbook should reference a defined name built here
instead of a hardcoded range, so adding rows to a master table never
requires touching a data-validation rule again.
"""
from openpyxl.workbook.defined_name import DefinedName


def define_dynamic_range(wb, name, sheet_name, col_letter, header_row=1):
    """Non-volatile INDEX/COUNTA dynamic range covering all filled rows
    below the header in `col_letter` on `sheet_name`. Grows automatically
    as rows are appended to the underlying table.
    """
    first_data_row = header_row + 1
    formula = (
        f"'{sheet_name}'!${col_letter}${first_data_row}:"
        f"INDEX('{sheet_name}'!${col_letter}:${col_letter},COUNTA('{sheet_name}'!${col_letter}:${col_letter}))"
    )
    dn = DefinedName(name, attr_text=formula)
    wb.defined_names[name] = dn
    return name


def define_static_range(wb, name, sheet_name, ref):
    """ref like '$B$2:$B$11' for fixed lookup lists."""
    formula = f"'{sheet_name}'!{ref}"
    dn = DefinedName(name, attr_text=formula)
    wb.defined_names[name] = dn
    return name
