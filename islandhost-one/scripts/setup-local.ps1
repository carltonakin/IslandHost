$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $project '.env'
if (Test-Path -LiteralPath $envFile) { throw 'A local .env already exists. It has not been overwritten.' }
function New-Secret {
 $bytes = New-Object byte[] 48
 [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
 return [Convert]::ToBase64String($bytes)
}
$dbPassword = New-Secret
$seedPassword = New-Secret
$jwtSecret = New-Secret
$refreshSecret = New-Secret
$sqlConnection = New-Object System.Data.SqlClient.SqlConnection 'Server=(local);Database=master;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;'
$sqlConnection.Open()
try {
 $check = $sqlConnection.CreateCommand()
 $check.CommandText = "SELECT COUNT(*) FROM sys.databases WHERE name IN ('IslandHostOne_Dev','IslandHostOne_Test')"
 if ([int]$check.ExecuteScalar() -ne 0) { throw 'An IslandHost development database already exists; configure .env manually to preserve it.' }
 foreach ($database in @('IslandHostOne_Dev','IslandHostOne_Test')) {
  $command = $sqlConnection.CreateCommand()
  $command.CommandText = "CREATE DATABASE [$database]"
  $command.ExecuteNonQuery() | Out-Null
 }
 $command = $sqlConnection.CreateCommand()
 $command.CommandText = "CREATE LOGIN [IslandHostOne_Local] WITH PASSWORD=N'$dbPassword', CHECK_POLICY=ON; USE [IslandHostOne_Dev]; CREATE USER [IslandHostOne_Local] FOR LOGIN [IslandHostOne_Local]; ALTER ROLE db_owner ADD MEMBER [IslandHostOne_Local]; USE [IslandHostOne_Test]; CREATE USER [IslandHostOne_Local] FOR LOGIN [IslandHostOne_Local]; ALTER ROLE db_owner ADD MEMBER [IslandHostOne_Local];"
 $command.ExecuteNonQuery() | Out-Null
 $content = Get-Content -LiteralPath (Join-Path $project '.env.example') -Raw
 $content = $content.Replace('DB_HOST=localhost','DB_HOST=lpc:localhost').Replace('DB_USERNAME=','DB_USERNAME=IslandHostOne_Local').Replace('DB_PASSWORD=',"DB_PASSWORD=$dbPassword").Replace('DB_TRUST_CERTIFICATE=false','DB_TRUST_CERTIFICATE=true').Replace('JWT_SECRET=',"JWT_SECRET=$jwtSecret").Replace('JWT_REFRESH_SECRET=',"JWT_REFRESH_SECRET=$refreshSecret").Replace('SEED_PASSWORD=',"SEED_PASSWORD=$seedPassword")
 $content += "`nDB_DRIVER=native`n"
 [System.IO.File]::WriteAllText($envFile,$content,(New-Object System.Text.UTF8Encoding($false)))
 Write-Output 'Created isolated development and test databases. Generated credentials are stored in the ignored root .env.'
} finally { $sqlConnection.Close() }

