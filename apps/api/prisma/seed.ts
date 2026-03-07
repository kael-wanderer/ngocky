import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...\n');

    // ─── Owner ────────────────────────────────────────
    const ownerPassword = await bcrypt.hash(process.env.OWNER_PASSWORD || 'ChangeMe123!', 12);
    const owner = await prisma.user.upsert({
        where: { email: process.env.OWNER_EMAIL || 'owner@ngocky.local' },
        update: {},
        create: {
            email: process.env.OWNER_EMAIL || 'owner@ngocky.local',
            name: process.env.OWNER_NAME || 'Owner',
            password: ownerPassword,
            role: 'OWNER',
            active: true,
        },
    });
    console.log(`✅ Owner: ${owner.email}`);

    // ─── Admin ────────────────────────────────────────
    const adminPassword = await bcrypt.hash('Admin123!', 12);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@ngocky.local' },
        update: {},
        create: {
            email: 'admin@ngocky.local',
            name: 'Admin User',
            password: adminPassword,
            role: 'ADMIN',
            active: true,
        },
    });
    console.log(`✅ Admin: ${admin.email}`);

    // ─── Normal User ──────────────────────────────────
    const userPassword = await bcrypt.hash('User1234!', 12);
    const user = await prisma.user.upsert({
        where: { email: 'user@ngocky.local' },
        update: {},
        create: {
            email: 'user@ngocky.local',
            name: 'Family Member',
            password: userPassword,
            role: 'USER',
            active: true,
        },
    });
    console.log(`✅ User: ${user.email}`);

    // ─── Goals ────────────────────────────────────────
    const goalCount = await prisma.goal.count();
    let goals: any[] = [];
    if (goalCount === 0) {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        goals = await Promise.all([
            prisma.goal.create({
                data: {
                    title: 'Gym Sessions',
                    description: 'Go to the gym at least 3 times per week',
                    userId: owner.id,
                    periodType: 'WEEKLY',
                    targetCount: 3,
                    currentCount: 1,
                    currentPeriodStart: weekStart,
                    pinToDashboard: true,
                    notificationEnabled: true,
                },
            }),
            prisma.goal.create({
                data: {
                    title: 'Read Books',
                    description: 'Read at least 10 sessions per month',
                    userId: owner.id,
                    periodType: 'MONTHLY',
                    targetCount: 10,
                    currentCount: 3,
                    currentPeriodStart: monthStart,
                    pinToDashboard: true,
                },
            }),
            prisma.goal.create({
                data: {
                    title: 'Meditation',
                    description: 'Meditate daily - 5 sessions per week minimum',
                    userId: user.id,
                    periodType: 'WEEKLY',
                    targetCount: 5,
                    currentCount: 2,
                    currentPeriodStart: weekStart,
                },
            }),
        ]);
        console.log(`✅ ${goals.length} goals created`);

        // ─── Check-ins ────────────────────────────────────
        await prisma.goalCheckIn.createMany({
            data: [
                { goalId: goals[0].id, userId: owner.id, quantity: 1, note: 'Leg day 🦵', date: new Date() },
                { goalId: goals[1].id, userId: owner.id, quantity: 1, note: 'Atomic Habits ch3', date: new Date() },
                { goalId: goals[1].id, userId: owner.id, quantity: 1, note: 'Atomic Habits ch4', date: new Date(now.getTime() - 86400000) },
                { goalId: goals[1].id, userId: owner.id, quantity: 1, note: 'Atomic Habits ch5', date: new Date(now.getTime() - 172800000) },
            ],
        });
        console.log(`✅ Check-ins created`);
    } else {
        console.log('⏭️ Goals already exist, skipping...');
    }

    // ─── Projects ─────────────────────────────────────
    const projectCount = await prisma.project.count();
    if (projectCount === 0) {
        const now = new Date();
        const projects = await Promise.all([
            prisma.project.create({
                data: {
                    title: 'Setup Home Server',
                    description: 'Configure Ubuntu server with Docker, monitoring, and backups',
                    category: 'Tech',
                    priority: 'HIGH',
                    status: 'IN_PROGRESS',
                    deadline: new Date(now.getTime() + 14 * 86400000),
                    assigneeId: owner.id,
                    createdById: owner.id,
                    pinToDashboard: true,
                    notificationEnabled: true,
                    kanbanOrder: 0,
                },
            }),
            prisma.project.create({
                data: {
                    title: 'Family Budget Review',
                    description: 'Review Q1 spending and update budget plan',
                    category: 'Finance',
                    priority: 'MEDIUM',
                    status: 'PLANNED',
                    deadline: new Date(now.getTime() + 7 * 86400000),
                    assigneeId: admin.id,
                    createdById: owner.id,
                    kanbanOrder: 1,
                },
            }),
            prisma.project.create({
                data: {
                    title: 'Garden Renovation',
                    description: 'Plan and execute garden renovation for spring',
                    category: 'Home',
                    priority: 'LOW',
                    status: 'PLANNED',
                    deadline: new Date(now.getTime() + 30 * 86400000),
                    createdById: owner.id,
                    kanbanOrder: 2,
                },
            }),
            prisma.project.create({
                data: {
                    title: 'Website Redesign',
                    description: 'Redesign personal portfolio website',
                    category: 'Tech',
                    priority: 'MEDIUM',
                    status: 'DONE',
                    createdById: owner.id,
                    kanbanOrder: 0,
                },
            }),
        ]);
        console.log(`✅ ${projects.length} projects created`);
    } else {
        console.log('⏭️ Projects already exist, skipping...');
    }

    // ─── Housework ────────────────────────────────────
    const houseworkCount = await prisma.houseworkItem.count();
    if (houseworkCount === 0) {
        const now = new Date();
        const housework = await Promise.all([
            prisma.houseworkItem.create({
                data: {
                    title: 'Weekly House Cleanup',
                    description: 'Vacuum, mop, dust all rooms',
                    assigneeId: user.id,
                    createdById: owner.id,
                    frequencyType: 'WEEKLY',
                    nextDueDate: new Date(now.getTime() + 3 * 86400000),
                    pinToDashboard: true,
                    notificationEnabled: true,
                },
            }),
            prisma.houseworkItem.create({
                data: {
                    title: 'Grocery Shopping',
                    description: 'Weekly groceries refill',
                    assigneeId: admin.id,
                    createdById: owner.id,
                    frequencyType: 'WEEKLY',
                    nextDueDate: new Date(now.getTime() + 2 * 86400000),
                },
            }),
            prisma.houseworkItem.create({
                data: {
                    title: 'AC Filter Cleaning',
                    description: 'Clean all AC filters in the house',
                    createdById: owner.id,
                    frequencyType: 'QUARTERLY',
                    nextDueDate: new Date(now.getTime() + 45 * 86400000),
                    estimatedCost: 50,
                    notificationEnabled: true,
                },
            }),
            prisma.houseworkItem.create({
                data: {
                    title: 'Deep Kitchen Clean',
                    description: 'Clean oven, fridge, cabinets',
                    assigneeId: owner.id,
                    createdById: owner.id,
                    frequencyType: 'MONTHLY',
                    nextDueDate: new Date(now.getTime() + 15 * 86400000),
                },
            }),
        ]);
        console.log(`✅ ${housework.length} housework items created`);
    } else {
        console.log('⏭️ Housework items already exist, skipping...');
    }

    // ─── Calendar Events ──────────────────────────────
    const eventCount = await prisma.calendarEvent.count();
    if (eventCount === 0) {
        const now = new Date();
        const events = await Promise.all([
            prisma.calendarEvent.create({
                data: {
                    title: 'Family Dinner',
                    description: 'Monthly family dinner at the restaurant',
                    startDate: new Date(now.getTime() + 5 * 86400000),
                    endDate: new Date(now.getTime() + 5 * 86400000 + 7200000),
                    isShared: true,
                    category: 'Family',
                    color: '#4F46E5',
                    createdById: owner.id,
                    participants: { create: [{ userId: admin.id }, { userId: user.id }] },
                },
            }),
            prisma.calendarEvent.create({
                data: {
                    title: 'Dentist Appointment',
                    startDate: new Date(now.getTime() + 3 * 86400000),
                    isShared: false,
                    category: 'Health',
                    color: '#DC2626',
                    createdById: owner.id,
                },
            }),
            prisma.calendarEvent.create({
                data: {
                    title: 'Weekend Trip',
                    description: 'Short weekend getaway',
                    startDate: new Date(now.getTime() + 10 * 86400000),
                    endDate: new Date(now.getTime() + 12 * 86400000),
                    allDay: true,
                    isShared: true,
                    category: 'Travel',
                    color: '#059669',
                    createdById: owner.id,
                    participants: { create: [{ userId: admin.id }, { userId: user.id }] },
                },
            }),
        ]);
        console.log(`✅ ${events.length} calendar events created`);
    } else {
        console.log('⏭️ Calendar events already exist, skipping...');
    }

    // ─── Expenses ─────────────────────────────────────
    const expenseCount = await prisma.expense.count();
    if (expenseCount === 0) {
        const now = new Date();
        await Promise.all([
            prisma.expense.create({ data: { date: new Date(), description: 'Grocery shopping', amount: 85.50, category: 'Food', scope: 'FAMILY', userId: admin.id } }),
            prisma.expense.create({ data: { date: new Date(), description: 'Electric bill', amount: 120, category: 'Utilities', scope: 'FAMILY', userId: owner.id, recurring: true } }),
            prisma.expense.create({ data: { date: new Date(now.getTime() - 86400000), description: 'Coffee subscription', amount: 15, category: 'Food', scope: 'PERSONAL', userId: owner.id, recurring: true } }),
            prisma.expense.create({ data: { date: new Date(now.getTime() - 2 * 86400000), description: 'Gym membership', amount: 45, category: 'Health', scope: 'PERSONAL', userId: owner.id, recurring: true } }),
            prisma.expense.create({ data: { date: new Date(now.getTime() - 3 * 86400000), description: 'Internet bill', amount: 40, category: 'Utilities', scope: 'FAMILY', userId: owner.id, recurring: true } }),
            prisma.expense.create({ data: { date: new Date(now.getTime() - 5 * 86400000), description: 'Phone case', amount: 25, category: 'Shopping', scope: 'PERSONAL', userId: user.id } }),
        ]);
        console.log(`✅ Expenses created`);
    } else {
        console.log('⏭️ Expenses already exist, skipping...');
    }

    // ─── Assets & Maintenance ─────────────────────────
    const assetCount = await prisma.asset.count();
    if (assetCount === 0) {
        const now = new Date();
        const motorbike = await prisma.asset.create({
            data: {
                name: 'Honda Wave',
                type: 'Motorbike',
                brand: 'Honda',
                model: 'Wave Alpha 110',
                purchaseDate: new Date('2022-06-15'),
                userId: owner.id,
            },
        });

        await prisma.maintenanceRecord.create({
            data: {
                assetId: motorbike.id,
                serviceDate: new Date(now.getTime() - 30 * 86400000),
                description: 'Oil change and general check',
                serviceType: 'Routine',
                cost: 15,
                vendor: 'Local Honda Service',
                nextRecommendedDate: new Date(now.getTime() + 60 * 86400000),
                userId: owner.id,
            },
        });

        const ac = await prisma.asset.create({
            data: {
                name: 'Living Room AC',
                type: 'Appliance',
                brand: 'Daikin',
                model: 'Inverter 1.5HP',
                userId: owner.id,
            },
        });

        await prisma.maintenanceRecord.create({
            data: {
                assetId: ac.id,
                serviceDate: new Date(now.getTime() - 60 * 86400000),
                description: 'Deep cleaning and gas refill',
                serviceType: 'Maintenance',
                cost: 35,
                vendor: 'AC Pro Services',
                nextRecommendedDate: new Date(now.getTime() + 120 * 86400000),
                userId: owner.id,
            },
        });
        console.log(`✅ Assets and maintenance records created`);
    } else {
        console.log('⏭️ Assets already exist, skipping...');
    }

    console.log('\n🎉 Seeding complete!');
    console.log('\nTest accounts:');
    console.log('  Owner: owner@ngocky.local / ChangeMe123!');
    console.log('  Admin: admin@ngocky.local / Admin123!');
    console.log('  User:  user@ngocky.local  / User1234!');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
