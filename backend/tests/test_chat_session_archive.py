"""归档旧档：只隐藏不删除，可恢复。"""

from datetime import timedelta

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.api.chat import (
    archive_chat_sessions,
    list_chat_sessions,
    restore_chat_session,
)
from app.db.models import ChatSession, Tenant, User, utc_now
from app.session.session_schema import ChatSessionArchiveRequest


def _session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _seed(db: Session, count: int = 5) -> User:
    db.add(Tenant(id="tenant_demo", name="Demo"))
    user = User(
        id="user_demo",
        tenant_id="tenant_demo",
        username="demo",
        role="admin",
        password_hash="x",
    )
    db.add(user)
    base = utc_now()
    for index in range(count):
        db.add(
            ChatSession(
                id=f"session_{index}",
                tenant_id="tenant_demo",
                user_id="user_demo",
                agent_id="agent_doc",
                title=f"第 {index} 档",
                status="active",
                updated_at=base + timedelta(minutes=index),
            )
        )
    db.commit()
    db.refresh(user)
    return user


def test_archive_keeps_the_newest_and_hides_the_rest() -> None:
    db = _session()
    user = _seed(db, count=5)

    result = archive_chat_sessions(
        ChatSessionArchiveRequest(tenant_id="tenant_demo", agent_id="agent_doc", keep_latest=2),
        current_user=user,
        db=db,
    )

    assert result["archived"] == 3
    assert result["kept"] == 2
    rows = db.exec(select(ChatSession).order_by(ChatSession.id)).all()
    statuses = {row.id: row.status for row in rows}
    assert statuses["session_4"] == "active"
    assert statuses["session_3"] == "active"
    assert statuses["session_0"] == "archived"


def test_archived_sessions_leave_the_sidebar_list_and_come_back_on_restore() -> None:
    db = _session()
    user = _seed(db, count=3)

    archive_chat_sessions(
        ChatSessionArchiveRequest(tenant_id="tenant_demo", agent_id="agent_doc", keep_latest=1),
        current_user=user,
        db=db,
    )

    visible = list_chat_sessions(tenant_id="tenant_demo", current_user=user, db=db)
    assert [row.id for row in visible] == ["session_2"]

    restore_chat_session(
        "session_0",
        tenant_id="tenant_demo",
        current_user=user,
        db=db,
    )
    visible = list_chat_sessions(tenant_id="tenant_demo", current_user=user, db=db)
    assert {row.id for row in visible} == {"session_2", "session_0"}


def test_dry_run_reports_candidates_without_writing() -> None:
    db = _session()
    user = _seed(db, count=4)

    result = archive_chat_sessions(
        ChatSessionArchiveRequest(
            tenant_id="tenant_demo",
            agent_id="agent_doc",
            keep_latest=1,
            dry_run=True,
        ),
        current_user=user,
        db=db,
    )

    assert result["archived"] == 0
    assert result["candidates"] == ["session_2", "session_1", "session_0"]
    assert all(row.status == "active" for row in db.exec(select(ChatSession)).all())


def test_archive_with_explicit_ids_ignores_keep_latest() -> None:
    db = _session()
    user = _seed(db, count=3)

    result = archive_chat_sessions(
        ChatSessionArchiveRequest(
            tenant_id="tenant_demo",
            session_ids=["session_0"],
            keep_latest=99,
        ),
        current_user=user,
        db=db,
    )

    assert result["archived"] == 1
    assert db.get(ChatSession, "session_0").status == "archived"
    assert db.get(ChatSession, "session_2").status == "active"


def test_archive_never_touches_another_users_sessions() -> None:
    db = _session()
    user = _seed(db, count=2)
    db.add(
        ChatSession(
            id="session_other",
            tenant_id="tenant_demo",
            user_id="someone_else",
            agent_id="agent_doc",
            title="别人的档",
            status="active",
            updated_at=utc_now() - timedelta(days=30),
        )
    )
    db.commit()

    result = archive_chat_sessions(
        ChatSessionArchiveRequest(tenant_id="tenant_demo", agent_id="agent_doc", keep_latest=0),
        current_user=user,
        db=db,
    )

    assert result["archived"] == 2
    assert db.get(ChatSession, "session_other").status == "active"
