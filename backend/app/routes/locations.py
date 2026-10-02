from flask import Blueprint, g, jsonify, request

from app.db import atomic, query
from app.security import auth, officer

bp = Blueprint('locations', __name__)


def _number(value, name, minimum=None, maximum=None):
    if value is None:
        return None
    if isinstance(value, bool):
        raise ValueError(name)
    try:
        result = float(value)
    except (TypeError, ValueError):
        raise ValueError(name)
    if not (-float('inf') < result < float('inf')):
        raise ValueError(name)
    if minimum is not None and result < minimum:
        raise ValueError(name)
    if maximum is not None and result > maximum:
        raise ValueError(name)
    return result


@bp.put('/current')
@auth
def save_current():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(error='A JSON object is required'), 400
    try:
        latitude = _number(data.get('latitude'), 'latitude', -90, 90)
        longitude = _number(data.get('longitude'), 'longitude', -180, 180)
        if latitude is None or longitude is None:
            raise ValueError('coordinates')
        accuracy = _number(data.get('accuracy'), 'accuracy', 0)
        heading = _number(data.get('heading'), 'heading', 0, 360)
        speed = _number(data.get('speed'), 'speed', 0)
    except ValueError:
        return jsonify(error='Valid coordinates and optional location measurements are required'), 400
    if accuracy is not None and accuracy > 1000:
        return jsonify(error='Location reading is too inaccurate to store (accuracy over 1000 m)'), 422
    navigating = data.get('navigating', False)
    if not isinstance(navigating, bool):
        return jsonify(error='navigating must be a boolean'), 400

    user_id = g.current_user['id']
    with atomic() as db:
        with db.cursor() as cursor:
            cursor.execute(
                'INSERT INTO user_locations '
                '(user_id,latitude,longitude,accuracy,heading,speed,navigating,updated_at) '
                'VALUES(%s,%s,%s,%s,%s,%s,%s,NOW()) '
                'ON DUPLICATE KEY UPDATE latitude=VALUES(latitude),longitude=VALUES(longitude),'
                'accuracy=VALUES(accuracy),heading=VALUES(heading),speed=VALUES(speed),'
                'navigating=VALUES(navigating),updated_at=NOW()',
                (user_id, latitude, longitude, accuracy, heading, speed, navigating),
            )
            if navigating:
                cursor.execute(
                    'INSERT INTO location_trail '
                    '(user_id,latitude,longitude,accuracy,heading,speed) '
                    'VALUES(%s,%s,%s,%s,%s,%s)',
                    (user_id, latitude, longitude, accuracy, heading, speed),
                )
    return jsonify(message='Location saved', navigating=navigating), 200


@bp.get('/current')
@auth
def current():
    location = query(
        'SELECT latitude,longitude,accuracy,heading,speed,navigating,updated_at '
        'FROM user_locations WHERE user_id=%s',
        (g.current_user['id'],),
        True,
    )
    return jsonify(location=location)


@bp.get('/live')
@officer
def live():
    locations = query(
        'SELECT l.user_id,l.latitude,l.longitude,l.accuracy,l.heading,l.speed,l.updated_at '
        'FROM user_locations l JOIN users u ON u.id=l.user_id '
        'WHERE l.navigating=TRUE AND l.updated_at>=NOW()-INTERVAL 10 MINUTE '
        "AND u.status='active' ORDER BY l.updated_at DESC"
    )
    return jsonify(items=locations)