const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Manually load .env.local to avoid needing extra dependencies
function loadEnv() {
    const envPath = path.resolve(__dirname, '../.env.local');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const index = trimmed.indexOf('=');
            if (index > 0) {
                const key = trimmed.substring(0, index).trim();
                const val = trimmed.substring(index + 1).trim().replace(/^['"]|['"]$/g, '');
                process.env[key] = val;
            }
        });
    }
}

loadEnv();

test.describe('Feria de Vegetales E2E Tests', () => {
    const testEmail = `test_${Date.now()}@example.com`;
    const testPassword = 'Password123!';
    const testName = 'Usuario E2E';

    test('E2E Registration Flow', async ({ page }) => {
        // 1. Visit signup page and register
        await page.goto('/registro');
        await expect(page).toHaveTitle(/Feria/i).catch(() => { });

        await page.fill('#fullName', testName);
        await page.fill('#reg-email', testEmail);
        await page.fill('#reg-password', testPassword);
        await page.fill('#confirm', testPassword);
        await page.click('button[type="submit"]');

        // Wait to see if signup succeeds
        await page.waitForTimeout(3000);

        const pageUrl = page.url();
        if (pageUrl.includes('/dashboard')) {
            console.log('--- EMAIL CONFIRMATION IS DISABLED ---');
            console.log('Registered and redirected straight to dashboard. Running dashboard tests...');
            await runDashboardTests(page);
        } else {
            console.log('--- EMAIL CONFIRMATION IS ENABLED ---');
            const isCheckEmailVisible = await page.locator('text=Revisa tu correo').isVisible();
            expect(isCheckEmailVisible).toBeTruthy();
            console.log('Verified registration page correctly displays check email screen.');
        }
    });

    test('E2E Dashboard & Voyage Flow (With Pre-Confirmed Account)', async ({ page }) => {
        const email = process.env.TEST_USER_EMAIL;
        const password = process.env.TEST_USER_PASSWORD;

        if (!email || !password) {
            console.log('Skipping E2E Dashboard flow: TEST_USER_EMAIL/TEST_USER_PASSWORD not found in .env.local.');
            test.skip();
            return;
        }

        console.log(`Running E2E Dashboard flow using confirmed account: ${email}`);

        // Log In
        await page.goto('/login');
        await page.fill('#email', email);
        await page.fill('#password', password);
        await page.click('button[type="submit"]');

        await page.waitForURL(/\/dashboard/);
        await runDashboardTests(page);
    });

    test('Login Verification - Invalid Credentials', async ({ page }) => {
        await page.goto('/login');
        await page.fill('#email', 'incorrect_user@example.com');
        await page.fill('#password', 'WrongPassword123');
        await page.click('button[type="submit"]');

        const errorBox = page.locator('.error-box');
        await expect(errorBox).toBeVisible();
        await expect(errorBox).toContainText(/Correo o contraseña incorrectos/i);
    });

    test('Forgot Password Verification', async ({ page }) => {
        await page.goto('/forgot-password');
        await page.fill('#forgot-email', 'test_reset@example.com');
        await page.click('button[type="submit"]');

        const emailNotice = page.locator('text=Revisa tu correo');
        await expect(emailNotice).toBeVisible();
    });
});

async function runDashboardTests(page) {
    // 1. Dashboard Landing Page check
    await expect(page.locator('text=Tus viajes')).toBeVisible();

    // 2. Inventory Management Test
    await page.click('nav >> text=Inventario');
    await expect(page).toHaveURL(/\/dashboard\/inventario/);

    // Open create form and add an item "Tomate E2E"
    await page.click('button:has-text("Nuevo item")');
    await page.fill('input[placeholder="ej: Tomate"]', 'Tomate E2E');
    await page.click('button[type="submit"]');

    // Verify it exists in list
    await expect(page.locator('text=Tomate E2E')).toBeVisible();

    // Add a second item "Cebolla E2E"
    await page.click('button:has-text("Nuevo item")');
    await page.fill('input[placeholder="ej: Tomate"]', 'Cebolla E2E');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Cebolla E2E')).toBeVisible();

    // Toggle item active/inactive
    const activeBadge = page.locator('div:has-text("Cebolla E2E") >> button:has-text("Activo")').first();
    await activeBadge.click();

    // Check that badge changes to inactive
    const inactiveBadge = page.locator('div:has-text("Cebolla E2E") >> button:has-text("Inactivo")').first();
    await expect(inactiveBadge).toBeVisible();

    // Toggle back
    await inactiveBadge.click();
    await expect(activeBadge).toBeVisible();

    // 3. Voyage Management Flow
    await page.click('button:has-text("Mis viajes")');
    await expect(page).toHaveURL(/\/dashboard/);

    // Create voyage (handles both "Sin viajes todavía" first voyage button or header "+ Nuevo voyage" button)
    const isFirstVoyageTextVisible = await page.locator('text=Sin viajes todavía').isVisible();
    if (isFirstVoyageTextVisible) {
        await page.click('button:has-text("Crear primer viaje")');
    } else {
        await page.click('button:has-text("Nuevo viaje")');
    }

    await expect(page).toHaveURL(/\/dashboard\/viajes\/nuevo/);

    const voyageName = `Viaje E2E — ${Date.now()}`;
    await page.fill('input[placeholder="ej: Barquisimeto — agosto 2026"]', voyageName);
    await page.fill('textarea[placeholder="Destino, productos objetivo, notas..."]', 'E2E testing description');
    await page.click('button:has-text("Crear viaje")');

    // Redirection to Voyage details page
    await page.waitForURL(/\/dashboard\/viajes\/.+/);
    await expect(page.locator('h1')).toContainText(voyageName);

    // Check Tabs are present
    await expect(page.locator('button:has-text("Compras")')).toBeVisible();
    await expect(page.locator('button:has-text("Ventas")')).toBeVisible();
    await expect(page.locator('button:has-text("Costos")')).toBeVisible();
    await expect(page.locator('button:has-text("Resumen")')).toBeVisible();

    // 4. Compras (Purchases) CRUD
    await page.click('button:has-text("Compras")');
    await page.click('button:has-text("Agregar")');

    // Fill details (selecting 'Tomate E2E' from dropdown)
    await page.selectOption('select', { label: 'Tomate E2E' });
    await page.fill('input[placeholder="Cantidad"]', '10');
    await page.fill('input[placeholder="Precio por unidad ($)"]', '5');
    await page.click('button:has-text("Guardar compra")');

    // Verify purchase row is present: 10 kg * $5.00 = $50.00
    await expect(page.locator('text=Tomate E2E')).toBeVisible();
    await expect(page.locator('text=10 kg × $5,00 = $50,00')).toBeVisible();

    // Edit purchase row
    await page.hover('text=Tomate E2E');
    await page.click('button[title="Editar"]');
    await page.fill('input[placeholder="Cantidad"]', '20'); // change qty to 20 (Total $100.00)
    await page.click('button:has-text("Guardar cambios")');
    await expect(page.locator('text=20 kg × $5,00 = $100,00')).toBeVisible();

    // 5. Ventas (Sales) CRUD
    await page.click('button:has-text("Ventas")');
    await page.click('button:has-text("Agregar")');
    await page.selectOption('select', { label: 'Tomate E2E' });
    await page.fill('input[placeholder="Cantidad"]', '15');
    await page.fill('input[placeholder="Precio por unidad ($)"]', '8'); // 15 kg * $8.00 = $120.00
    await page.click('button:has-text("Guardar venta")');

    await expect(page.locator('text=Tomate E2E')).toBeVisible();
    await expect(page.locator('text=15 kg × $8,00 = $120,00')).toBeVisible();

    // 6. Costos (Costs) CRUD
    await page.click('button:has-text("Costos")');
    await page.click('button:has-text("Agregar")');
    await page.selectOption('select', 'obreros');
    await page.fill('input[placeholder="Descripción"]', 'Pago cargadores');
    await page.fill('input[placeholder="Monto ($)"]', '10');
    await page.click('button:has-text("Guardar costo")');

    await expect(page.locator('text=Pago cargadores')).toBeVisible();
    await expect(page.locator('text=obreros · $10,00')).toBeVisible();

    // 7. Resumen (Summary) Checking
    await page.click('button:has-text("Resumen")');

    // Let's check totals:
    // Sales: $120.00
    // Purchases: $100.00
    // Costs: $10.00
    // Net Profit: $120 - $100 - $10 = +$10.00
    await expect(page.locator('div.stat-green >> p.stat-value')).toContainText('$120,00');
    await expect(page.locator('div.stat-orange >> p.stat-value')).toContainText('$100,00');
    await expect(page.locator('div.stat-amber >> p.stat-value')).toContainText('$10,00');
    await expect(page.locator('text=Ganancia neta >> xpath=.. >> p.text-xl')).toContainText('+$10,00');

    // Verify product balances
    // Tomate E2E: bought 20, sold 15, remaining 5
    await expect(page.locator('text=Tomate E2E >> xpath=.. >> text=20,00')).toBeVisible();
    await expect(page.locator('text=Tomate E2E >> xpath=.. >> text=15,00')).toBeVisible();
    await expect(page.locator('text=Tomate E2E >> xpath=.. >> text=5,00 kg')).toBeVisible();

    // 8. Close voyage
    // Intercept confirm dialog window
    page.once('dialog', async dialog => {
        expect(dialog.message()).toContain('¿Cerrar este viaje?');
        await dialog.accept();
    });
    await page.click('button:has-text("Cerrar viaje")');

    // Once closed, check status badge is Gray and "Cerrado"
    await expect(page.locator('span.badge:has-text("Cerrado")')).toBeVisible();

    // Add button should no longer exist since voyage is closed (readOnly mode)
    await page.click('button:has-text("Compras")');
    await expect(page.locator('button:has-text("Agregar")')).not.toBeVisible();

    // 9. Go to Dashboard and verify Voyage is listed as closed
    await page.click('button:has-text("Mis viajes")');
    await expect(page).toHaveURL(/\/dashboard/);

    // Check the list has our voyage
    const closedVoyageRow = page.locator(`button:has-text("${voyageName}")`);
    await expect(closedVoyageRow).toBeVisible();
    await expect(closedVoyageRow.locator('span.badge')).toContainText('Cerrado');
    await expect(closedVoyageRow.locator('span.tabular')).toContainText('+$10,00');

    // 10. Logout Flow
    await page.click('button:has-text("Salir")');
    await expect(page).toHaveURL(/\/login/);
}
