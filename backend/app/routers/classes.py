from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ClassRoom, Student, Session as ClassSession, User
from app.schemas import ClassRoomCreate, ClassRoomResponse
from app.auth import require_teacher

router = APIRouter(prefix="/classes", tags=["Classes"])

@router.get("", response_model=List[ClassRoomResponse])
def get_classes(db: Session = Depends(get_db), current_user: User = Depends(require_teacher)):
    classes = db.query(ClassRoom).order_by(ClassRoom.name.asc()).all()
    res = []
    for c in classes:
        st_count = db.query(Student).filter(Student.class_id == c.id, Student.is_active == True).count()
        sess_count = db.query(ClassSession).filter(ClassSession.class_id == c.id).count()
        item = ClassRoomResponse(
            id=c.id,
            name=c.name,
            section=c.section,
            description=c.description,
            created_at=c.created_at,
            student_count=st_count,
            session_count=sess_count
        )
        res.append(item)
    return res

@router.post("", response_model=ClassRoomResponse, status_code=status.HTTP_201_CREATED)
def create_class(class_in: ClassRoomCreate, db: Session = Depends(get_db), current_user: User = Depends(require_teacher)):
    new_class = ClassRoom(
        name=class_in.name,
        section=class_in.section,
        description=class_in.description
    )
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    return ClassRoomResponse(
        id=new_class.id,
        name=new_class.name,
        section=new_class.section,
        description=new_class.description,
        created_at=new_class.created_at,
        student_count=0,
        session_count=0
    )

@router.patch("/{class_id}", response_model=ClassRoomResponse)
def update_class(class_id: str, class_in: ClassRoomCreate, db: Session = Depends(get_db), current_user: User = Depends(require_teacher)):
    cls = db.query(ClassRoom).filter(ClassRoom.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
        
    cls.name = class_in.name
    cls.section = class_in.section
    cls.description = class_in.description
    db.commit()
    db.refresh(cls)
    
    st_count = db.query(Student).filter(Student.class_id == cls.id, Student.is_active == True).count()
    sess_count = db.query(ClassSession).filter(ClassSession.class_id == cls.id).count()
    return ClassRoomResponse(
        id=cls.id,
        name=cls.name,
        section=cls.section,
        description=cls.description,
        created_at=cls.created_at,
        student_count=st_count,
        session_count=sess_count
    )
