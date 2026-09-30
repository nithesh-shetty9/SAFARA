from contextlib import contextmanager
from flask import g
import pymysql
from pymysql.cursors import DictCursor
from app.config import settings

def get_db():
    if 'db' not in g:
        g.db = pymysql.connect(host=settings.MYSQL_HOST, port=settings.MYSQL_PORT, user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD, database=settings.MYSQL_DATABASE, cursorclass=DictCursor,
            autocommit=False, charset='utf8mb4', connect_timeout=5, read_timeout=15, write_timeout=15)
    return g.db

def query(sql, params=(), one=False):
    with get_db().cursor() as c:
        c.execute(sql, params)
        return c.fetchone() if one else c.fetchall()

def execute(sql, params=(), commit=True):
    db=get_db()
    try:
        with db.cursor() as c:
            c.execute(sql, params); last_id, affected = c.lastrowid, c.rowcount
        if commit: db.commit()
        return last_id, affected
    except Exception:
        db.rollback(); raise

@contextmanager
def atomic():
    db=get_db()
    try:
        yield db; db.commit()
    except Exception:
        db.rollback(); raise

def close_db(_=None):
    db=g.pop('db',None)
    if db: db.close()
