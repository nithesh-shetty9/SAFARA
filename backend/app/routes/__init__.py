from app.routes.auth import bp as a
from app.routes.incidents import bp as i
from app.routes.admin import bp as ad
from app.routes.ngo import bp as n
from app.routes.sos import bp as s
from app.routes.contacts import bp as c
from app.routes.analytics import bp as an
from app.routes.system import bp as sy
from app.routes.health import bp as h
def register_routes(app):
 for b,p in [(a,'/api/v1/auth'),(i,'/api/v1/incidents'),(ad,'/api/v1/admin'),(n,'/api/v1/ngo'),(s,'/api/v1/sos'),(c,'/api/v1/contacts'),(an,'/api/v1/analytics'),(sy,'/api/v1/system'),(h,'/api/v1')]:app.register_blueprint(b,url_prefix=p)
