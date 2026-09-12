# Recalculate disposable synthetic files in a NEW hidden Excel instance.
# Requires desktop Excel; never attaches to the user's existing workbooks.
param([Parameter(Mandatory=$true)][string]$Directory)
$ErrorActionPreference = 'Stop'
$verificationRoot = (Resolve-Path -LiteralPath $Directory).Path
$manifest = Get-Content -LiteralPath (Join-Path $verificationRoot 'manifest.json') -Raw | ConvertFrom-Json
function LocalFile([string]$Name) {
  $candidate = [IO.Path]::GetFullPath((Join-Path $verificationRoot $Name))
  if (!$candidate.StartsWith($verificationRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Verification file escapes its directory.' }
  return $candidate
}
$excel = $null
$book = $null
$results = [Collections.Generic.List[object]]::new()
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.EnableEvents = $false
  $excel.AskToUpdateLinks = $false
  $excel.AutomationSecurity = 3
  $version = $excel.Version
  $build = $excel.Build
  foreach ($case in $manifest.cases) {
    $book = $excel.Workbooks.Open((LocalFile $case.file), 0, $false)
    foreach ($edit in $case.edits) {
      if ($null -eq $edit.value) { $book.Worksheets.Item($edit.sheet).Range($edit.cell).ClearContents() | Out-Null }
      elseif ($edit.value -is [string]) { $book.Worksheets.Item($edit.sheet).Range($edit.cell).Formula = "'$($edit.value)" }
      else { $book.Worksheets.Item($edit.sheet).Range($edit.cell).Value2 = [double]$edit.value }
    }
    if ($case.sort) {
      $sortRange = $book.Worksheets.Item($case.sort.sheet).Range($case.sort.range)
      $missing = [Type]::Missing
      $sortRange.Sort($sortRange.Columns.Item(1), 1, $missing, $missing, 1, $missing, 1, 2) | Out-Null
      [Runtime.InteropServices.Marshal]::FinalReleaseComObject($sortRange) | Out-Null
    }
    $excel.CalculateFullRebuild()
    foreach ($expect in $case.expect) {
      $cell = $book.Worksheets.Item($expect.sheet).Range($expect.cell)
      $actual = $cell.Value2
      $display = $cell.Text
      if ($expect.PSObject.Properties.Name -contains 'error') {
        if ($display -ne $expect.error) { throw "$($case.name) $($expect.cell): expected $($expect.error), got $display" }
      } elseif ([double]$actual -ne [double]$expect.value) {
        throw "$($case.name) $($expect.cell): expected $($expect.value), got $actual"
      }
      [Runtime.InteropServices.Marshal]::FinalReleaseComObject($cell) | Out-Null
    }
    $results.Add([pscustomobject]@{case=$case.name; checks=$case.expect.Count; result='pass'})
    $book.Close($false)
    [Runtime.InteropServices.Marshal]::FinalReleaseComObject($book) | Out-Null
    $book = $null
    Write-Output "PASS $($case.name)"
  }
  # Save/reopen also checks formula and named-range persistence in the native engine.
  $book = $excel.Workbooks.Open((LocalFile $manifest.preview_file), 0, $false)
  $excel.CalculateFullRebuild()
  $book.SaveAs((LocalFile 'period-native-recalculated.xlsx'), 51)
  foreach ($sheet in $manifest.preview_sheets) {
    $book.Worksheets.Item($sheet).ExportAsFixedFormat(0, (LocalFile ($sheet.Replace(' ', '-') + '.pdf')))
  }
  $book.Close($false)
  [Runtime.InteropServices.Marshal]::FinalReleaseComObject($book) | Out-Null
  $book = $excel.Workbooks.Open((LocalFile 'period-native-recalculated.xlsx'), 0, $true)
  $excel.CalculateFullRebuild()
  foreach ($expect in $manifest.cases[0].expect) {
    $cell = $book.Worksheets.Item($expect.sheet).Range($expect.cell)
    if ($expect.PSObject.Properties.Name -contains 'error') {
      if ($cell.Text -ne $expect.error) { throw 'Reopen error-state mismatch.' }
    } elseif ([double]$cell.Value2 -ne [double]$expect.value) { throw 'Reopen numeric mismatch.' }
    [Runtime.InteropServices.Marshal]::FinalReleaseComObject($cell) | Out-Null
  }
  $results.Add([pscustomobject]@{case='save-reopen';checks=$manifest.cases[0].expect.Count;result='pass'})
  [pscustomobject]@{excel_version=$version;excel_build=$build;cases=$results;status='pass'} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (LocalFile 'verification.json') -Encoding utf8
  Write-Output "PASS native Excel $version build $build ($($results.Count) cases)"
} finally {
  if ($book) { $book.Close($false); [Runtime.InteropServices.Marshal]::FinalReleaseComObject($book) | Out-Null }
  if ($excel) { $excel.Quit(); [Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel) | Out-Null }
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
