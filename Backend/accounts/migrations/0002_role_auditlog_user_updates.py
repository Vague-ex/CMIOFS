from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        # 1. Create the Role table
        migrations.CreateModel(
            name='Role',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True,
                                           serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50, unique=True)),
                ('code', models.CharField(max_length=30, unique=True)),
                ('description', models.TextField(blank=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'ordering': ['name']},
        ),

        # 2. Add phone + is_deleted + role_ref to User
        migrations.AddField(
            model_name='user',
            name='phone',
            field=models.CharField(max_length=30, blank=True),
        ),
        migrations.AddField(
            model_name='user',
            name='is_deleted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='role_ref',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='users',
                to='accounts.role',
            ),
        ),

        # 3. Create AuditLog table
        migrations.CreateModel(
            name='AuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True,
                                           serialize=False, verbose_name='ID')),
                ('action', models.CharField(
                    max_length=10,
                    choices=[('CREATE', 'Created'), ('UPDATE', 'Updated'), ('DELETE', 'Deleted')],
                )),
                ('resource_type', models.CharField(max_length=50)),
                ('resource_id', models.IntegerField(null=True, blank=True)),
                ('resource_name', models.CharField(max_length=200, blank=True)),
                ('changes', models.JSONField(default=dict, blank=True)),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('ip_address', models.GenericIPAddressField(null=True, blank=True)),
                ('performed_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='audit_logs',
                    to='accounts.user',
                )),
            ],
            options={'ordering': ['-timestamp']},
        ),
    ]