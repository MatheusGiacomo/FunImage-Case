# scripts/seed_dev.py
import os
import django

# Se você rodar via shell do manage.py, o django.setup() já foi feito.
# Mas garantimos a importação do modelo de usuário correto.
from django.contrib.auth import get_user_model

User = get_user_model()

def run_seed():
    print("🌱 Iniciando a criação de usuários demo...")

    # --- 1. CRIAR ADMIN DEMO ---
    admin_email = 'admin@fotopro.com'
    admin_pass = 'admin1234'
    
    if not User.objects.filter(email=admin_email).exists():
        User.objects.create_superuser(
            email=admin_email,
            password=admin_pass
        )
        print(f"✅ Admin criado com sucesso ({admin_email})")
    else:
        print(f"🟡 Admin ({admin_email}) já existe. Pulando...")

    # --- 2. CRIAR CLIENTE DEMO ---
    client_email = 'cliente@fotopro.com'
    client_pass = 'demo1234'

    if not User.objects.filter(email=client_email).exists():
        User.objects.create_user(
            email=client_email,
            password=client_pass
        )
        print(f"✅ Cliente criado com sucesso ({client_email})")
    else:
        print(f"🟡 Cliente ({client_email}) já existe. Pulando...")

    print("🚀 Seed finalizado!")

if __name__ == "__main__":
    run_seed()
else:
    run_seed()