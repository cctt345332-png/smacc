"""
Backup Service — نسخ احتياطي حقيقي باستخدام pg_dump / psql
=============================================================

استراتيجية النسخ الاحتياطي:
  - pg_dump --clean --if-exists --create
    → يُضمّن في الملف أوامر DROP/CREATE لكل كائن
    → عند الاستعادة نتصل بـ postgres (ليس erp) ونشغّل الملف
    → هذا يتجنب مشكلة "لا يمكن حذف DB وأنت متصل بها"

استراتيجية الاستعادة:
  1. إنهاء الاتصالات الأخرى بـ erp DB
  2. تشغيل ملف SQL على قاعدة postgres (الملف يحتوي DROP DATABASE + CREATE DATABASE)
  3. إعادة تشغيل الـ connection pool في FastAPI
"""
import os
import asyncio
from datetime import datetime
from pathlib import Path

BACKUP_DIR = Path("/backups")
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

# بيانات الاتصال من متغيرات البيئة
PG_HOST     = os.getenv("PGHOST", "postgres")
PG_PORT     = os.getenv("PGPORT", "5432")
PG_USER     = os.getenv("PGUSER", "erp")
PG_PASSWORD = os.getenv("PGPASSWORD", "erp")
PG_DATABASE = os.getenv("PGDATABASE", "erp")


def _backup_filename(tenant_id: str, backup_type: str = "manual") -> str:
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    return f"backup_{tenant_id[:8]}_{backup_type}_{ts}.sql"


async def _run_cmd(cmd: list[str], env: dict, timeout: int = 120) -> tuple[int, str, str]:
    """تشغيل أمر shell وإرجاع (returncode, stdout, stderr)"""
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return (
            proc.returncode,
            stdout.decode("utf-8", errors="replace"),
            stderr.decode("utf-8", errors="replace"),
        )
    except asyncio.TimeoutError:
        proc.kill()
        raise


# ══════════════════════════════════════════════════════════════════════
# إنشاء نسخة احتياطية
# ══════════════════════════════════════════════════════════════════════

async def create_backup(tenant_id: str, backup_type: str = "manual") -> dict:
    """
    ينشئ نسخة احتياطية كاملة باستخدام pg_dump.
    الملف يحتوي على DROP/CREATE لكل كائن (--clean --if-exists --create)
    حتى يمكن الاستعادة الكاملة لاحقاً.
    """
    filename = _backup_filename(tenant_id, backup_type)
    filepath = BACKUP_DIR / filename

    env = os.environ.copy()
    env["PGPASSWORD"] = PG_PASSWORD

    cmd = [
        "pg_dump",
        "-h", PG_HOST,
        "-p", PG_PORT,
        "-U", PG_USER,
        "-d", PG_DATABASE,
        "--format=plain",       # SQL نصي قابل للقراءة
        "--clean",              # أضف DROP قبل كل CREATE
        "--if-exists",          # DROP IF EXISTS (لا يفشل إذا لم يوجد)
        "--create",             # أضف DROP DATABASE + CREATE DATABASE في البداية
        "--no-password",
        "--encoding=UTF8",
        "--no-owner",           # لا تُضمّن OWNER (يتجنب مشاكل الصلاحيات)
        "--no-privileges",      # لا تُضمّن GRANT/REVOKE
        "-f", str(filepath),
    ]

    try:
        rc, stdout, stderr = await _run_cmd(cmd, env, timeout=120)

        if rc != 0:
            raise Exception(f"pg_dump فشل:\n{stderr}")

        # تحقق أن الملف غير فارغ
        size_bytes = filepath.stat().st_size
        if size_bytes < 100:
            raise Exception("الملف الناتج فارغ أو صغير جداً — تحقق من اتصال قاعدة البيانات")

        return {
            "filename": filename,
            "size": _format_size(size_bytes),
            "size_bytes": size_bytes,
            "type": backup_type,
            "created_at": datetime.utcnow().isoformat(),
            "status": "success",
        }

    except asyncio.TimeoutError:
        if filepath.exists():
            filepath.unlink()
        raise Exception("انتهت مهلة النسخ الاحتياطي (120 ثانية)")
    except Exception:
        if filepath.exists():
            filepath.unlink()
        raise


# ══════════════════════════════════════════════════════════════════════
# قائمة النسخ الاحتياطية
# ══════════════════════════════════════════════════════════════════════

async def list_backups(tenant_id: str) -> list[dict]:
    """قائمة النسخ الاحتياطية المتاحة لهذا الـ tenant"""
    backups = []
    prefix = f"backup_{tenant_id[:8]}_"

    if not BACKUP_DIR.exists():
        return []

    for f in sorted(BACKUP_DIR.glob(f"{prefix}*.sql"), reverse=True):
        stat = f.stat()
        # اسم الملف: backup_{tenant8}_{type}_{YYYYMMDD}_{HHMMSS}.sql
        parts = f.stem.split("_")
        btype = parts[2] if len(parts) > 2 else "manual"
        created_str = ""
        if len(parts) >= 5:
            try:
                dt = datetime.strptime(f"{parts[3]}_{parts[4]}", "%Y%m%d_%H%M%S")
                created_str = dt.isoformat()
            except Exception:
                created_str = datetime.fromtimestamp(stat.st_mtime).isoformat()
        else:
            created_str = datetime.fromtimestamp(stat.st_mtime).isoformat()

        backups.append({
            "filename": f.name,
            "size": _format_size(stat.st_size),
            "size_bytes": stat.st_size,
            "type": btype,
            "created_at": created_str,
            "status": "success",
        })

    return backups[:50]  # آخر 50 نسخة


# ══════════════════════════════════════════════════════════════════════
# جلب مسار الملف (مع حماية path traversal)
# ══════════════════════════════════════════════════════════════════════

def get_backup_path(filename: str) -> Path | None:
    """جلب مسار ملف النسخة الاحتياطية مع التحقق من الأمان"""
    # منع path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        return None
    if not filename.endswith(".sql"):
        return None
    filepath = BACKUP_DIR / filename
    if not filepath.exists():
        return None
    return filepath


# ══════════════════════════════════════════════════════════════════════
# استعادة النسخة الاحتياطية
# ══════════════════════════════════════════════════════════════════════

async def restore_backup(filepath: Path) -> dict:
    """
    استعادة قاعدة البيانات من نسخة احتياطية.

    الاستراتيجية الآمنة:
    1. إنهاء الاتصالات الأخرى بـ erp DB (من postgres DB)
    2. تشغيل ملف SQL على قاعدة postgres
       (الملف يحتوي DROP DATABASE erp + CREATE DATABASE erp + كل البيانات)
    3. الـ backend سيفقد اتصاله مؤقتاً ثم يعيد الاتصال تلقائياً

    ملاحظة: هذا يعمل لأن pg_dump --create يُضمّن:
      DROP DATABASE IF EXISTS erp;
      CREATE DATABASE erp ...;
      \\connect erp
      ... (بيانات الجداول)
    """
    env = os.environ.copy()
    env["PGPASSWORD"] = PG_PASSWORD

    # ── الخطوة 1: إنهاء الاتصالات الأخرى ──────────────────────────
    terminate_cmd = [
        "psql",
        "-h", PG_HOST,
        "-p", PG_PORT,
        "-U", PG_USER,
        "-d", "postgres",
        "--no-password",
        "-c",
        (
            f"SELECT pg_terminate_backend(pid) "
            f"FROM pg_stat_activity "
            f"WHERE datname = '{PG_DATABASE}' "
            f"AND pid <> pg_backend_pid();"
        ),
    ]

    # ── الخطوة 2: تشغيل ملف الاستعادة على postgres DB ──────────────
    # نتصل بـ postgres لأن الملف يحتوي DROP DATABASE erp
    restore_cmd = [
        "psql",
        "-h", PG_HOST,
        "-p", PG_PORT,
        "-U", PG_USER,
        "-d", "postgres",
        "--no-password",
        "-f", str(filepath),
        "--set", "ON_ERROR_STOP=0",   # استمر حتى لو فيه أخطاء بسيطة
    ]

    try:
        # الخطوة 1: إنهاء الاتصالات
        rc1, out1, err1 = await _run_cmd(terminate_cmd, env, timeout=30)
        # لا نوقف العملية إذا فشل هذا الأمر — نكمل

        # الخطوة 2: الاستعادة
        rc2, out2, err2 = await _run_cmd(restore_cmd, env, timeout=300)

        # نتحقق من نجاح الاستعادة بشكل معقول
        # psql قد يُرجع returncode != 0 بسبب تحذيرات بسيطة
        # نتحقق من وجود "ERROR" حقيقي في الـ stderr
        critical_errors = [
            line for line in err2.splitlines()
            if "ERROR:" in line
            and "already exists" not in line
            and "does not exist" not in line
        ]

        if rc2 != 0 and critical_errors:
            raise Exception(
                f"فشلت الاستعادة:\n" + "\n".join(critical_errors[:5])
            )

        return {
            "status": "success",
            "message": "تمت استعادة قاعدة البيانات بنجاح. سيتم إعادة تحميل الصفحة.",
            "filename": filepath.name,
            "warnings": len(err2.splitlines()) - len(critical_errors),
        }

    except asyncio.TimeoutError:
        raise Exception("انتهت مهلة الاستعادة (300 ثانية)")


# ══════════════════════════════════════════════════════════════════════
# حذف نسخة احتياطية
# ══════════════════════════════════════════════════════════════════════

async def delete_backup(filename: str) -> bool:
    """حذف نسخة احتياطية"""
    filepath = get_backup_path(filename)
    if filepath and filepath.exists():
        filepath.unlink()
        return True
    return False


# ══════════════════════════════════════════════════════════════════════
# تنسيق الحجم
# ══════════════════════════════════════════════════════════════════════

def _format_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"
