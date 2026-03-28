
from django.db import migrations


ROLES = [
    {
        'code': 'SYSTEM_ADMIN',
        'name': 'System Admin',
        'description': 'Full access to all modules including user and settings management.',
    },
    {
        'code': 'PURCHASING_MANAGER',
        'name': 'Purchasing Manager',
        'description': 'Creates and approves purchase orders; manages items and suppliers.',
    },
    {
        'code': 'WAREHOUSE_STAFF',
        'name': 'Warehouse Staff',
        'description': 'Updates stock levels, receives goods, and dispatches deliveries.',
    },
]


def seed_roles(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')
    for r in ROLES:
        Role.objects.get_or_create(code=r['code'], defaults={
            'name': r['name'],
            'description': r['description'],
        })


def unseed_roles(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')
    Role.objects.filter(code__in=[r['code'] for r in ROLES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_role_auditlog_user_updates'),
    ]

    operations = [
        migrations.RunPython(seed_roles, unseed_roles),
    ]