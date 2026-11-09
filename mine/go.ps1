# Chinazes: Luanti + Mineclonia + куча модов, шейдеры и ресурс-паки одной кнопкой.
# Запуск: двойной клик по chinazes.bat с tengizka.fun/mine
# Всё ставится в отдельную папку, админ-права не нужны.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
try { $Host.UI.RawUI.WindowTitle = 'Chinazes' } catch {}

# ---------- что ставим (версии зафиксированы, чтобы у обоих было одно и то же) ----------
$CDB  = 'https://content.luanti.org/packages'
$Game = 'ryvnf/mineclonia:39595'
$Mods = @(
  'SaKeL/everness:39540',
  'SilverSandstone/leads:31637',
  'FreeLikeGNU/goblins:32959',
  'ZenonSeth/logistica:38824',
  'IcyDiamond/elepower:33541',
  'EmoryNB/mcl_cozy:33419',
  'EmoryNB/mcl_decor:35460',
  'apercy/airutils:38202',
  'apercy/supercub:34450',
  'apercy/hidroplane:34449',
  'apercy/automobiles_pck:39407',
  'apercy/steampunk_blimp:38331',
  'Calinou/moreores:30151',
  'SaKeL/x_farming:39544',
  'IcyDiamond/melterns:37133',
  'grorp/ggraffiti:28833',
  'Impulse/inventory_pouches:37412',
  'TomCon/discovery_maps:34183',
  'cultom/hammermod:39390',
  'nandology/copper_golem:37835',
  'SaKeL/deathstats:39547',
  'EmoryNB/mcl_morefood:32961',
  'TenPlus1/bonemeal:39284',
  'IcyDiamond/fluid_lib:37062',
  'luk3yx/flow:35331',
  'luk3yx/formspec_ast:26490'
)
$ModNames = @(
  'airutils','automobiles_beetle','automobiles_buggy','automobiles_catrelle','automobiles_coupe',
  'automobiles_delorean','automobiles_lib','automobiles_motorcycle','automobiles_roadster',
  'automobiles_trans_am','automobiles_vespa','bonemeal','bucket_compat','copper_golem','deathstats',
  'discovery_maps','elepower_compat','elepower_dynamics','elepower_farming','elepower_lighting',
  'elepower_machines','elepower_mining','elepower_nuclear','elepower_papi','elepower_solar',
  'elepower_thermal','elepower_tome','elepower_tools','elepower_wireless','everness','flow',
  'fluid_lib','fluid_tanks','fluid_transfer','fluidity','formspec_ast','ggraffiti','goblins',
  'hammermod','hidroplane','inventory_pouches','leads','logistica','mcl_cozy','mcl_decor',
  'mcl_morefood','metal_melter','moreores','multifurnace','steampunk_blimp','supercub','tinkering',
  'x_farming'
)
$Textures = @('MysticTempest/refi_textures:36164', 'Mirtilo/bauniclonia:37608')
$Port = 30000
$Password = 'chinazes'

# ---------- папки ----------
$Base = Join-Path $env:LOCALAPPDATA 'Chinazes'
if ($Base -match '[^\x00-\x7F]') { $Base = Join-Path $env:SystemDrive 'Chinazes' }  # кириллица в пути ломает игру
$L    = Join-Path $Base 'luanti'
$Tmp  = Join-Path $Base 'tmp'
$Exe  = Join-Path $L 'bin\luanti.exe'
$Conf = Join-Path $L 'minetest.conf'
$World = Join-Path $L 'worlds\chinazes'
New-Item -ItemType Directory -Force -Path $Base, $Tmp | Out-Null

function Say($t, $c = 'Gray') { Write-Host $t -ForegroundColor $c }
function Ok($t) { Write-Host "  [ok] $t" -ForegroundColor Green }
function Fail($t) {
  Write-Host ''
  Write-Host "  Чёт пошло не так: $t" -ForegroundColor Red
  Write-Host '  Скинь скрин этого окна Тенгизу.' -ForegroundColor Red
  Read-Host '  Enter, чтобы закрыть' | Out-Null
  exit 1
}

function Download($url, $file) {
  for ($i = 1; $i -le 3; $i++) {
    try { Invoke-WebRequest -Uri $url -OutFile $file -UseBasicParsing -Headers @{ 'User-Agent' = 'chinazes-installer' }; return }
    catch { if ($i -eq 3) { throw } ; Start-Sleep -Seconds (2 * $i) }
  }
}

function Unzip($zip, $dir) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [IO.Compression.ZipFile]::ExtractToDirectory($zip, $dir)
}

# Скачивает zip и кладёт содержимое в $Target\$Folder. Пропускает, если та же версия уже стоит.
function Install-Zip($url, $version, $Target, $Folder, $label) {
  $dest = Join-Path $Target $Folder
  $mark = Join-Path $dest '.chinazes'
  if ((Test-Path $mark) -and ((Get-Content $mark -Raw).Trim() -eq "$version")) { Ok "$label (уже стоит)"; return }
  $zip = Join-Path $Tmp "$Folder.zip"
  $ex  = Join-Path $Tmp "$Folder-x"
  if (Test-Path $ex) { Remove-Item $ex -Recurse -Force }
  Download $url $zip
  Unzip $zip $ex
  $items = @(Get-ChildItem $ex -Force)
  $src = $ex
  if ($items.Count -eq 1 -and $items[0].PSIsContainer) { $src = $items[0].FullName }
  New-Item -ItemType Directory -Force -Path $Target | Out-Null
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  Move-Item $src $dest
  if (Test-Path $ex) { Remove-Item $ex -Recurse -Force }
  Remove-Item $zip -Force
  Set-Content -Path $mark -Value "$version" -Encoding ASCII
  Ok $label
}

function Install-Cdb($spec, $sub) {
  $id, $rel = $spec.Split(':')
  $name = $id.Split('/')[1]
  Install-Zip "$CDB/$id/releases/$rel/download/" $rel (Join-Path $L $sub) $name $id
}

function Ensure-Luanti {
  if (Test-Path $Exe) { Ok 'Luanti уже стоит'; return }
  Say '  Качаю Luanti...'
  try {
    $r = Invoke-RestMethod -Uri 'https://api.github.com/repos/luanti-org/luanti/releases/latest' -UseBasicParsing -Headers @{ 'User-Agent' = 'chinazes-installer' }
  } catch { Fail 'не достучался до GitHub за Luanti. Проверь интернет или VPN.' }
  $asset = $r.assets | Where-Object { $_.name -match 'win64\.zip$' } | Select-Object -First 1
  if (-not $asset) { $asset = $r.assets | Where-Object { $_.name -match 'win.*64.*\.zip$' } | Select-Object -First 1 }
  if (-not $asset) { Fail 'не нашёл сборку Luanti для Windows.' }
  $zip = Join-Path $Tmp 'luanti.zip'
  $ex  = Join-Path $Tmp 'luanti-x'
  if (Test-Path $ex) { Remove-Item $ex -Recurse -Force }
  Download $asset.browser_download_url $zip
  Unzip $zip $ex
  $bin = Get-ChildItem $ex -Recurse -Filter 'luanti.exe' | Where-Object { $_.Directory.Name -eq 'bin' } | Select-Object -First 1
  if (-not $bin) { Fail 'в архиве Luanti нет luanti.exe.' }
  if (Test-Path $L) { Remove-Item $L -Recurse -Force }
  Move-Item $bin.Directory.Parent.FullName $L
  Remove-Item $ex -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item $zip -Force
  Ok "Luanti $($r.tag_name)"
}

# Меняет нужные строки в конфиге, остальные не трогает.
function Set-Conf([hashtable]$kv, $file) {
  $lines = @()
  if (Test-Path $file) { $lines = @(Get-Content $file) }
  $keys = $kv.Keys
  $lines = @($lines | Where-Object { $k = ($_ -split '=', 2)[0].Trim(); -not ($keys -contains $k) })
  foreach ($k in $keys) { $lines += "$k = $($kv[$k])" }
  [IO.File]::WriteAllLines($file, $lines, (New-Object Text.UTF8Encoding $false))
}

function Setup-Graphics($nick, $weak) {
  $refi = Join-Path $L 'textures\refi_textures'
  $g = @{
    'language' = 'ru'; 'name' = $nick
    'texture_path' = $refi
    'enable_waving_water' = 'true'; 'enable_waving_leaves' = 'true'; 'enable_waving_plants' = 'true'
    'enable_translucent_foliage' = 'true'; 'smooth_lighting' = 'true'; 'enable_3d_clouds' = 'true'
  }
  if ($weak) {
    $g += @{ 'enable_dynamic_shadows' = 'false'; 'enable_bloom' = 'false'; 'enable_volumetric_lighting' = 'false'
             'enable_water_reflections' = 'false'; 'enable_auto_exposure' = 'false'; 'viewing_range' = '120' }
  } else {
    $g += @{ 'enable_dynamic_shadows' = 'true'; 'shadow_map_max_distance' = '160'; 'shadow_filters' = '2'
             'enable_bloom' = 'true'; 'enable_volumetric_lighting' = 'true'; 'enable_water_reflections' = 'true'
             'enable_auto_exposure' = 'true'; 'tone_mapping' = 'true'; 'viewing_range' = '220' }
  }
  Set-Conf $g $Conf
}

function Setup-World {
  New-Item -ItemType Directory -Force -Path $World | Out-Null
  $wm = Join-Path $World 'world.mt'
  $kv = @{
    'gameid' = 'mineclonia'; 'world_name' = 'Chinazes'
    'backend' = 'sqlite3'; 'player_backend' = 'sqlite3'; 'auth_backend' = 'sqlite3'; 'mod_storage_backend' = 'sqlite3'
    'enable_damage' = 'true'; 'creative_mode' = 'false'
  }
  foreach ($m in $ModNames) { $kv["load_mod_$m"] = 'true' }
  Set-Conf $kv $wm
}

function Get-Nick {
  $f = Join-Path $Base 'nick.txt'
  if (Test-Path $f) {
    $n = (Get-Content $f -Raw).Trim()
    $a = Read-Host "  Ник: $n. Enter, чтобы оставить, или впиши новый"
    if ($a.Trim()) { $n = $a.Trim() }
  } else { $n = Read-Host '  Придумай ник (латиницей, без пробелов)' }
  $n = ($n -replace '[^A-Za-z0-9_\-]', '')
  if (-not $n) { $n = 'Player' + (Get-Random -Maximum 999) }
  if ($n.Length -gt 20) { $n = $n.Substring(0, 20) }
  Set-Content -Path $f -Value $n -Encoding ASCII
  return $n
}

function Show-IPs {
  Say ''
  Say '  Скинь корешу один из этих адресов:' Yellow
  try {
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } |
      ForEach-Object {
        $tag = ''
        if ($_.InterfaceAlias -match 'Radmin') { $tag = '  <- Radmin VPN, если вы в разных домах' }
        elseif ($_.IPAddress -match '^(192\.168\.|10\.|172\.)') { $tag = '  <- если вы на одном Wi-Fi' }
        Say ("    {0,-16} {1}{2}" -f $_.IPAddress, $_.InterfaceAlias, $tag) White
      }
  } catch { ipconfig | Select-String 'IPv4' | ForEach-Object { Say "    $_" White } }
}

function Start-Client($addr, $nick) {
  Start-Process -FilePath $Exe -WorkingDirectory $L -ArgumentList @('--go', '--address', $addr, '--port', "$Port", '--name', $nick, '--password', $Password)
}

function Install-All {
  Say ''
  Say '  Ставлю игру Mineclonia...' Cyan
  Install-Cdb $Game 'games'
  Say '  Ставлю моды...' Cyan
  foreach ($m in $Mods) { Install-Cdb $m 'mods' }
  Install-Textures
}

function Install-Textures {
  Say '  Ставлю ресурс-паки...' Cyan
  foreach ($t in $Textures) { Install-Cdb $t 'textures' }
}

function Ask-Weak {
  $a = Read-Host '  Комп слабый, ноут или встройка? (y = да, Enter = нет, врубаем всю красоту)'
  return ($a -match '^[yYдД]')
}

function Do-Host {
  $nick = Get-Nick
  $weak = Ask-Weak
  Ensure-Luanti
  Install-All
  Setup-Graphics $nick $weak
  Set-Conf @{ 'server_name' = 'Chinazes'; 'server_announce' = 'false'; 'default_privs' = 'interact, shout, home'
              'disallow_empty_password' = 'false'; 'max_users' = '8' } $Conf
  Setup-World
  Ok 'Мир chinazes готов'

  $log = Join-Path $Base 'server.log'
  # если сервер остался висеть с прошлого раза, гасим его
  try {
    Get-CimInstance Win32_Process -Filter "Name='luanti.exe'" -ErrorAction Stop |
      Where-Object { $_.CommandLine -match '--server' } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
  } catch {}
  if (Test-Path $log) { Remove-Item $log -Force }
  Say ''
  Say '  Поднимаю сервер. Если Windows спросит про брандмауэр, жми «Разрешить доступ».' Yellow
  $srv = Start-Process -FilePath $Exe -WorkingDirectory $L -PassThru `
    -ArgumentList @('--server', '--world', "`"$World`"", '--gameid', 'mineclonia', '--port', "$Port", '--logfile', "`"$log`"")
  $ready = $false
  for ($i = 0; $i -lt 180; $i++) {
    Start-Sleep -Seconds 1
    if ($srv.HasExited) { break }
    if ((Test-Path $log) -and (Select-String -Path $log -Pattern 'listening on' -Quiet)) { $ready = $true; break }
    if ($i % 10 -eq 9) { Say "  ...грузится ($($i + 1) сек), первый запуск дольше" }
  }
  if (-not $ready) {
    Say ''
    if (Test-Path $log) { Get-Content $log -Tail 25 | ForEach-Object { Say "  $_" DarkGray } }
    if (-not $srv.HasExited) { Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue }
    Fail 'сервер не поднялся. Лог выше.'
  }
  Ok 'Сервер работает'
  Show-IPs
  Say ''
  Say "  Порт: $Port. Пароль для входа у обоих: $Password" Yellow
  Start-Client '127.0.0.1' $nick
  Ok 'Запускаю игру. Чиназес!'
  Say ''
  Say '  ВАЖНО: это окно и есть сервер. Не закрывай его, пока играете.' Yellow
  Say '  Наигрались? Напиши в чате игры /shutdown или нажми тут Enter.' Yellow
  Read-Host '  Enter = выключить сервер' | Out-Null
  if (-not $srv.HasExited) { Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue }
  Ok 'Сервер выключен, мир сохранён в папке worlds\chinazes'
}

function Do-Join {
  $nick = Get-Nick
  $weak = Ask-Weak
  $last = Join-Path $Base 'host.txt'
  $def = ''
  if (Test-Path $last) { $def = (Get-Content $last -Raw).Trim() }
  $prompt = '  Адрес кореша (его скрипт показал IP)'
  if ($def) { $prompt += " [Enter = $def]" }
  $addr = (Read-Host $prompt).Trim()
  if (-not $addr) { $addr = $def }
  if (-not $addr) { Fail 'не ввёл адрес.' }
  Set-Content -Path $last -Value $addr -Encoding ASCII
  Ensure-Luanti
  Install-Textures
  Setup-Graphics $nick $weak
  Say ''
  Say '  Моды качать не надо: сервер кореша сам отдаст всё при входе.' Yellow
  Start-Client $addr $nick
  Ok 'Залетаю. Чиназес!'
}

# ---------- меню ----------
Clear-Host
Say ''
Say '   ____ _     _                            ' Green
Say '  / ___| |__ (_)_ __   __ _ ______ _ ___   ' Green
Say ' | |   | ''_ \| | ''_ \ / _` |_  / _` / __|  ' Green
Say ' | |___| | | | | | | | (_| |/ / (_| \__ \  ' Green
Say '  \____|_| |_|_|_| |_|\__,_/___\__,_|___/  ' Green
Say ''
Say '  Mineclonia + 53 мода + шейдеры + ресурс-паки' White
Say "  Папка: $Base" DarkGray
Say ''
Say '  [1] Я хост: поднимаю сервер и играю'
Say '  [2] Подключаюсь к корешу'
Say '  [3] Просто открыть Luanti'
Say ''
$c = Read-Host '  Жми цифру'
try {
  switch ($c.Trim()) {
    '1' { Do-Host }
    '2' { Do-Join }
    '3' { Ensure-Luanti; Start-Process -FilePath $Exe -WorkingDirectory $L }
    default { Say '  Не понял. Запусти ещё раз и нажми 1 или 2.' }
  }
} catch { Fail $_.Exception.Message }
Say ''
Read-Host '  Enter, чтобы закрыть это окно' | Out-Null
