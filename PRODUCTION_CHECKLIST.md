# Production Deployment Checklist & Step-by-Step Guide
### Cricket Association Management & Live Scoring Platform

This document outlines the step-by-step production deployment procedures for hosting the platform on a fresh Linux virtual machine (Ubuntu 22.04 LTS / 24.04 LTS).

---

## 1. System Preparation & Docker Installation

### 1.1 Update System Packages
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git ufw apt-transport-https ca-certificates gnupg lsb-release
```

### 1.2 Install Docker Engine & Docker Compose
```bash
# Add Docker's official GPG key:
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Set up Docker repository:
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker:
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable and start Docker service:
sudo systemctl enable docker
sudo systemctl start docker

# Add your current user to the docker group (optional):
sudo usermod -aG docker $USER
newgrp docker
```

---

## 2. Firewall Configuration (UFW)

Only open ports 80 (HTTP), 443 (HTTPS), and 22 (SSH). **Never expose MongoDB port 27017 or backend port 5000 to the public internet.**

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

---

## 3. Clone Repository & Setup Environment

```bash
cd /opt
sudo git clone https://github.com/athilingam3336-dotcom/cricketworld7.git cricket-platform
cd cricket-platform
sudo chown -R $USER:$USER .
```

### 3.1 Configure Environment Variables
Copy the production environment templates:

```bash
cp backend/.env.production.example backend/.env
cp mobile_frontend/.env.production.example mobile_frontend/.env
```

Edit `backend/.env` with your secure credentials:
```bash
nano backend/.env
```
Ensure you set:
- `NODE_ENV=production`
- `JWT_SECRET` (generate using `openssl rand -base64 48`)
- `ADMIN_INITIAL_EMAIL=your_super_admin@yourdomain.com`
- `ADMIN_INITIAL_PASSWORD=YourStrongPasswordHere!`
- `ALLOWED_ORIGINS=https://cricket.yourdomain.com`
- `BREVO_API_KEY` or `SMTP_*` parameters for transactional email delivery.

---

## 4. Launch Services with Docker Compose

Run the production Docker Compose setup:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Verify all three containers are healthy:
```bash
docker compose -f docker-compose.prod.yml ps
```
You should see:
- `cricket-mongodb-prod` (healthy, internal port 27017)
- `cricket-backend-prod` (healthy, internal port 5000)
- `cricket-frontend-prod` (healthy, ports 80/443)

---

## 5. Enable HTTPS with Let's Encrypt (Certbot)

### 5.1 Obtain Initial SSL Certificate
Install Certbot on the host:
```bash
sudo apt install -y certbot
```

Request a certificate using the standalone or webroot plugin:
```bash
sudo certbot certonly --webroot -w ./certbot/www -d cricket.yourdomain.com --email admin@yourdomain.com --agree-tos --no-eff-email
```

### 5.2 Activate SSL in Nginx
1. Link your SSL certificate into `./certbot/conf/live/cricket.yourdomain.com/`.
2. Apply the sample Nginx SSL configuration:
```bash
cp nginx-ssl.sample.conf mobile_frontend/nginx.conf
# Replace cricket.yourdomain.com with your actual registered domain
sed -i 's/cricket.yourdomain.com/your-actual-domain.com/g' mobile_frontend/nginx.conf
```
3. Restart frontend container:
```bash
docker compose -f docker-compose.prod.yml restart frontend
```

### 5.3 Automated Certificate Renewal Cron
Certificates expire every 90 days. Set up automatic renewal:
```bash
sudo crontab -e
```
Add the following line to renew weekly and reload Nginx:
```cron
0 3 * * 1 certbot renew --quiet && docker compose -f /opt/cricket-platform/docker-compose.prod.yml exec -T frontend nginx -s reload
```

---

## 6. Verify Deployment Health

### 6.1 Test Health Endpoint
```bash
curl -I https://cricket.yourdomain.com/api/health
```
Expected output:
```http
HTTP/2 200 
content-type: application/json; charset=utf-8
```
Response body:
```json
{
  "status": "UP",
  "database": "CONNECTED",
  "timestamp": "2026-11-23T..."
}
```

### 6.2 Test Security Headers
```bash
curl -I https://cricket.yourdomain.com
```
Verify presence of:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`

---

## 7. Automated MongoDB Backups & Disaster Recovery

Set up a daily automated backup cron job:

```bash
crontab -e
```
Add daily backup at 2:00 AM UTC:
```cron
0 2 * * * /opt/cricket-platform/scripts/backup_mongo.sh >> /var/log/cricket_backup.log 2>&1
```

To test backup immediately:
```bash
./scripts/backup_mongo.sh
```

To restore from a backup:
```bash
./scripts/restore_mongo.sh /opt/cricket-platform/backups/mongo_<timestamp>/cricket_db
```

---

## 8. Log Rotation & Monitoring

To prevent Docker container logs from filling up disk storage:
Configure Docker daemon logging limits in `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  }
}
```

Restart Docker daemon:
```bash
sudo systemctl restart docker
```

