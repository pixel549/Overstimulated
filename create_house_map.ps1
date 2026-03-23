# Create Excel spreadsheet for house map visualization

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Add()
$worksheet = $workbook.Worksheets.Item(1)
$worksheet.Name = "House Map"

# Room data: RAW coordinates (need to add OFFSET)
$OFFSET_X = 270
$OFFSET_Y = 233

$rooms = @(
    @{Name="DOG_YARD"; RawX=-269; RawY=-233; W=48; H=46; Type="Yard"},
    @{Name="CHICKEN_YARD"; RawX=-221; RawY=-233; W=34; H=46; Type="Yard"},
    @{Name="SHED"; RawX=-202; RawY=-232; W=14; H=8; Type="Utility"},
    @{Name="CHICKEN_RUN"; RawX=-198; RawY=-212; W=9; H=20; Type="Yard"},
    @{Name="CHICKEN_COOP"; RawX=-195; RawY=-200; W=4; H=2; Type="Yard"},
    @{Name="LIVING_ROOM"; RawX=-241; RawY=-226; W=20; H=27; Type="Living"},
    @{Name="KITCHEN"; RawX=-249; RawY=-226; W=8; H=13; Type="Living"},
    @{Name="READING_DOG_ROOM"; RawX=-256; RawY=-226; W=7; H=13; Type="Living"},
    @{Name="BABYS_ROOM"; RawX=-256; RawY=-208; W=15; H=9; Type="Bedroom"},
    @{Name="MASTER_BEDROOM"; RawX=-264; RawY=-217; W=8; H=18; Type="Bedroom"},
    @{Name="ENSUITE"; RawX=-264; RawY=-226; W=8; H=9; Type="Bathroom"},
    @{Name="HOUSEMATE_ROOM"; RawX=-221; RawY=-219; W=11; H=5; Type="Bedroom"},
    @{Name="HOME_OFFICE"; RawX=-221; RawY=-209; W=5; H=10; Type="Office"},
    @{Name="SPARE_ROOM"; RawX=-216; RawY=-209; W=6; H=10; Type="Bedroom"},
    @{Name="CORRIDOR_RIGHT"; RawX=-221; RawY=-214; W=11; H=5; Type="Corridor"},
    @{Name="CORRIDOR_LEFT"; RawX=-256; RawY=-213; W=15; H=5; Type="Corridor"},
    @{Name="PATIO_MAIN"; RawX=-221; RawY=-226; W=15; H=7; Type="Patio"},
    @{Name="PATIO_STRIP"; RawX=-210; RawY=-219; W=4; H=20; Type="Patio"},
    @{Name="DOG_PATIO"; RawX=-264; RawY=-199; W=43; H=5; Type="Patio"}
)

# Color scheme for room types
$colors = @{
    "Yard" = 10;        # Green
    "Utility" = 15;     # Gray
    "Living" = 44;      # Gold
    "Bedroom" = 37;     # Light Blue
    "Bathroom" = 28;    # Teal
    "Office" = 35;      # Light Green
    "Corridor" = 19;    # Light Yellow
    "Patio" = 45        # Orange
}

# Set up grid dimensions
$gridWidth = 85
$gridHeight = 50

# Set column widths to make cells square (approximately)
for ($col = 1; $col -le $gridWidth; $col++) {
    $worksheet.Columns.Item($col).ColumnWidth = 2.5
}

# Set row heights to match column width
for ($row = 1; $row -le $gridHeight; $row++) {
    $worksheet.Rows.Item($row).RowHeight = 15
}

# Fill in rooms
foreach ($room in $rooms) {
    $actualX = $room.RawX + $OFFSET_X
    $actualY = $room.RawY + $OFFSET_Y

    # Convert to Excel columns/rows (1-based)
    $startCol = $actualX + 1
    $startRow = $actualY + 1
    $endCol = $actualX + $room.W
    $endRow = $actualY + $room.H

    # Fill the room area
    $range = $worksheet.Range($worksheet.Cells.Item($startRow, $startCol), $worksheet.Cells.Item($endRow, $endCol))

    # Set room name in center cell
    $centerRow = [Math]::Floor(($startRow + $endRow) / 2)
    $centerCol = [Math]::Floor(($startCol + $endCol) / 2)
    $worksheet.Cells.Item($centerRow, $centerCol).Value2 = $room.Name

    # Apply color
    $colorIndex = $colors[$room.Type]
    $range.Interior.ColorIndex = $colorIndex

    # Add borders
    $range.Borders.LineStyle = 1
    $range.Borders.Weight = 2
}

# Add coordinate labels every 5 columns
for ($col = 1; $col -le $gridWidth; $col += 5) {
    $actualX = $col - 1
    # Add to a row above the grid (will insert rows later)
}

# Add coordinate labels every 5 rows
for ($row = 1; $row -le $gridHeight; $row += 5) {
    $actualY = $row - 1
    # Add to a column left of the grid (will insert columns later)
}

# Create legend on the right side
$legendStartCol = $gridWidth + 5
$legendStartRow = 2

$worksheet.Cells.Item($legendStartRow, $legendStartCol).Value2 = "LEGEND"
$worksheet.Cells.Item($legendStartRow, $legendStartCol).Font.Bold = $true
$worksheet.Cells.Item($legendStartRow, $legendStartCol).Font.Size = 14

$legendRow = $legendStartRow + 2
$typeNames = @("Yard", "Utility", "Living", "Bedroom", "Bathroom", "Office", "Corridor", "Patio")

foreach ($typeName in $typeNames) {
    $worksheet.Cells.Item($legendRow, $legendStartCol).Value2 = $typeName
    $worksheet.Cells.Item($legendRow, $legendStartCol).Interior.ColorIndex = $colors[$typeName]
    $worksheet.Cells.Item($legendRow, $legendStartCol).Borders.LineStyle = 1
    $legendRow++
}

# Auto-fit legend columns
$worksheet.Columns.Item($legendStartCol).AutoFit()

# Save the workbook next to this script so the output path always exists
$savePath = Join-Path $PSScriptRoot "house_map.xlsx"
$workbook.SaveAs($savePath)
$workbook.Close()
$excel.Quit()

# Clean up COM objects
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($worksheet) | Out-Null
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($workbook) | Out-Null
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
[System.GC]::Collect()
[System.GC]::WaitForPendingFinalizers()

Write-Host "House map created successfully at: $savePath"
