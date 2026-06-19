$inputFile = Join-Path $PSScriptRoot 'icd10_full.json'
$outputFile = Join-Path $PSScriptRoot 'icd10_data.js'
$json = Get-Content -Path $inputFile -Raw | ConvertFrom-Json
$codes = @()
foreach ($group in $json) {
    if ($group.codes) {
        foreach ($entry in $group.codes) {
            if ($entry.code -and $entry.desc) {
                $codes += [PSCustomObject]@{
                    code = $entry.code
                    description = $entry.desc
                }
            }
        }
    }
}
$jsonText = $codes | ConvertTo-Json -Depth 5
$content = "const icdData = $jsonText;"
Set-Content -Path $outputFile -Value $content -Encoding utf8
Write-Output "Wrote $($codes.Count) ICD entries to $outputFile"