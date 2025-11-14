# Notification system tables created via SQL

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('certs', '0017_customuser_is_sso_user_customuser_sso_subject_id_and_more'),
    ]

    operations = [
        # Tables already created via SQL script
        migrations.RunSQL(migrations.RunSQL.noop, reverse_sql=migrations.RunSQL.noop),
    ]
