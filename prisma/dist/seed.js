"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var mainAccounts, createdMainAccounts, _i, mainAccounts_1, mainAccount, created, categories, createdCategories, _a, categories_1, category, mainAccountId, existing, created, accounts, _b, accounts_1, account, categoryKey, categoryId, mainAccountId, stores, _c, stores_1, store;
        var _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    console.log('Starting seed...');
                    // ============ CREATE CHARTS OF ACCOUNTS ============
                    console.log('Creating Charts of Account...');
                    mainAccounts = [
                        { code: '1', name: 'Assets', type: client_1.AccountType.ASSET, description: 'Resources the business owns' },
                        { code: '2', name: 'Liabilities', type: client_1.AccountType.LIABILITY, description: 'What the business owes to others' },
                        { code: '3', name: 'Equity', type: client_1.AccountType.EQUITY, description: "The owner's stake in the business" },
                        { code: '4', name: 'Revenue', type: client_1.AccountType.REVENUE, description: 'Money earned from sales' },
                        { code: '5', name: 'Expenses', type: client_1.AccountType.EXPENSE, description: 'Costs to run the business' },
                    ];
                    createdMainAccounts = {};
                    _i = 0, mainAccounts_1 = mainAccounts;
                    _e.label = 1;
                case 1:
                    if (!(_i < mainAccounts_1.length)) return [3 /*break*/, 4];
                    mainAccount = mainAccounts_1[_i];
                    return [4 /*yield*/, prisma.mainAccount.upsert({
                            where: { code: mainAccount.code },
                            update: mainAccount,
                            create: mainAccount,
                        })];
                case 2:
                    created = _e.sent();
                    createdMainAccounts[mainAccount.code] = {
                        id: created.id,
                        code: created.code,
                        name: created.name,
                        type: created.type,
                    };
                    console.log("  Created Main Account: ".concat(mainAccount.name));
                    _e.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    categories = [
                        // Assets
                        { mainAccountCode: '1', name: 'Current Assets', description: 'Assets that can be converted to cash within one year' },
                        { mainAccountCode: '1', name: 'Fixed Assets', description: 'Long-term tangible assets' },
                        // Liabilities
                        { mainAccountCode: '2', name: 'Current Liabilities', description: 'Debts due within one year' },
                        { mainAccountCode: '2', name: 'Long-Term Liabilities', description: 'Debts due after one year' },
                        // Expenses
                        { mainAccountCode: '5', name: 'Operating Expenses', description: 'Day-to-day business costs' },
                        { mainAccountCode: '5', name: 'Cost of Goods Sold', description: 'Direct costs of producing goods sold' },
                    ];
                    createdCategories = {};
                    _a = 0, categories_1 = categories;
                    _e.label = 5;
                case 5:
                    if (!(_a < categories_1.length)) return [3 /*break*/, 9];
                    category = categories_1[_a];
                    mainAccountId = createdMainAccounts[category.mainAccountCode].id;
                    return [4 /*yield*/, prisma.accountCategory.findFirst({
                            where: {
                                mainAccountId: mainAccountId,
                                name: category.name,
                            },
                        })];
                case 6:
                    existing = _e.sent();
                    if (existing) {
                        createdCategories["".concat(category.mainAccountCode, "_").concat(category.name)] = {
                            id: existing.id,
                            name: existing.name,
                        };
                        console.log("  Category already exists: ".concat(category.name));
                        return [3 /*break*/, 8];
                    }
                    return [4 /*yield*/, prisma.accountCategory.create({
                            data: {
                                name: category.name,
                                description: category.description,
                                mainAccountId: mainAccountId,
                            },
                        })];
                case 7:
                    created = _e.sent();
                    createdCategories["".concat(category.mainAccountCode, "_").concat(category.name)] = {
                        id: created.id,
                        name: created.name,
                    };
                    console.log("  Created Category: ".concat(category.name));
                    _e.label = 8;
                case 8:
                    _a++;
                    return [3 /*break*/, 5];
                case 9:
                    accounts = [
                        // ============ ASSETS ============
                        // Current Assets
                        { code: '1010', name: 'Cash', type: client_1.AccountType.ASSET, subType: client_1.AccountSubType.CURRENT_ASSET, mainAccountCode: '1', categoryName: 'Current Assets', balance: 50000 },
                        { code: '1020', name: 'Accounts Receivable', type: client_1.AccountType.ASSET, subType: client_1.AccountSubType.CURRENT_ASSET, mainAccountCode: '1', categoryName: 'Current Assets', balance: 25000 },
                        { code: '1030', name: 'Inventory', type: client_1.AccountType.ASSET, subType: client_1.AccountSubType.CURRENT_ASSET, mainAccountCode: '1', categoryName: 'Current Assets', balance: 75000 },
                        { code: '1040', name: 'Prepaid Expenses', type: client_1.AccountType.ASSET, subType: client_1.AccountSubType.CURRENT_ASSET, mainAccountCode: '1', categoryName: 'Current Assets', balance: 5000 },
                        // Fixed Assets
                        { code: '1100', name: 'Equipment', type: client_1.AccountType.ASSET, subType: client_1.AccountSubType.FIXED_ASSET, mainAccountCode: '1', categoryName: 'Fixed Assets', balance: 120000 },
                        { code: '1110', name: 'Vehicle', type: client_1.AccountType.ASSET, subType: client_1.AccountSubType.FIXED_ASSET, mainAccountCode: '1', categoryName: 'Fixed Assets', balance: 85000 },
                        { code: '1120', name: 'Building', type: client_1.AccountType.ASSET, subType: client_1.AccountSubType.FIXED_ASSET, mainAccountCode: '1', categoryName: 'Fixed Assets', balance: 500000 },
                        // ============ LIABILITIES ============
                        // Current Liabilities
                        { code: '2010', name: 'Accounts Payable', type: client_1.AccountType.LIABILITY, subType: client_1.AccountSubType.CURRENT_LIABILITY, mainAccountCode: '2', categoryName: 'Current Liabilities', balance: 15000 },
                        { code: '2020', name: 'Credit Card Balances', type: client_1.AccountType.LIABILITY, subType: client_1.AccountSubType.CURRENT_LIABILITY, mainAccountCode: '2', categoryName: 'Current Liabilities', balance: 5000 },
                        { code: '2030', name: 'Short-Term Loans', type: client_1.AccountType.LIABILITY, subType: client_1.AccountSubType.CURRENT_LIABILITY, mainAccountCode: '2', categoryName: 'Current Liabilities', balance: 20000 },
                        // Long-Term Liabilities
                        { code: '2100', name: 'Bank Loans', type: client_1.AccountType.LIABILITY, subType: client_1.AccountSubType.LONG_TERM_LIABILITY, mainAccountCode: '2', categoryName: 'Long-Term Liabilities', balance: 150000 },
                        { code: '2110', name: 'Mortgages', type: client_1.AccountType.LIABILITY, subType: client_1.AccountSubType.LONG_TERM_LIABILITY, mainAccountCode: '2', categoryName: 'Long-Term Liabilities', balance: 350000 },
                        // ============ EQUITY ============
                        { code: '3010', name: "Owner's Capital", type: client_1.AccountType.EQUITY, subType: client_1.AccountSubType.OTHER, mainAccountCode: '3', categoryName: '', balance: 400000 },
                        { code: '3020', name: 'Retained Earnings', type: client_1.AccountType.EQUITY, subType: client_1.AccountSubType.OTHER, mainAccountCode: '3', categoryName: '', balance: 150000 },
                        { code: '3030', name: "Owner's Draws/Dividends", type: client_1.AccountType.EQUITY, subType: client_1.AccountSubType.OTHER, mainAccountCode: '3', categoryName: '', balance: 0 },
                        // ============ REVENUE ============
                        { code: '4010', name: 'Sales Revenue', type: client_1.AccountType.REVENUE, subType: client_1.AccountSubType.OTHER, mainAccountCode: '4', categoryName: '', balance: 0 },
                        { code: '4020', name: 'Service Revenue', type: client_1.AccountType.REVENUE, subType: client_1.AccountSubType.OTHER, mainAccountCode: '4', categoryName: '', balance: 0 },
                        { code: '4030', name: 'Interest Income', type: client_1.AccountType.REVENUE, subType: client_1.AccountSubType.OTHER, mainAccountCode: '4', categoryName: '', balance: 0 },
                        { code: '4040', name: 'Rental Income', type: client_1.AccountType.REVENUE, subType: client_1.AccountSubType.OTHER, mainAccountCode: '4', categoryName: '', balance: 0 },
                        // ============ EXPENSES ============
                        // Operating Expenses
                        { code: '5010', name: 'Rent', type: client_1.AccountType.EXPENSE, subType: client_1.AccountSubType.OPERATING_EXPENSE, mainAccountCode: '5', categoryName: 'Operating Expenses', balance: 0 },
                        { code: '5020', name: 'Utilities', type: client_1.AccountType.EXPENSE, subType: client_1.AccountSubType.OPERATING_EXPENSE, mainAccountCode: '5', categoryName: 'Operating Expenses', balance: 0 },
                        { code: '5030', name: 'Salaries & Wages', type: client_1.AccountType.EXPENSE, subType: client_1.AccountSubType.OPERATING_EXPENSE, mainAccountCode: '5', categoryName: 'Operating Expenses', balance: 0 },
                        { code: '5040', name: 'Marketing', type: client_1.AccountType.EXPENSE, subType: client_1.AccountSubType.OPERATING_EXPENSE, mainAccountCode: '5', categoryName: 'Operating Expenses', balance: 0 },
                        { code: '5050', name: 'Insurance', type: client_1.AccountType.EXPENSE, subType: client_1.AccountSubType.OPERATING_EXPENSE, mainAccountCode: '5', categoryName: 'Operating Expenses', balance: 0 },
                        { code: '5060', name: 'Office Supplies', type: client_1.AccountType.EXPENSE, subType: client_1.AccountSubType.OPERATING_EXPENSE, mainAccountCode: '5', categoryName: 'Operating Expenses', balance: 0 },
                        // COGS
                        { code: '5100', name: 'Cost of Goods Sold', type: client_1.AccountType.EXPENSE, subType: client_1.AccountSubType.COGS, mainAccountCode: '5', categoryName: 'Cost of Goods Sold', balance: 0 },
                    ];
                    _b = 0, accounts_1 = accounts;
                    _e.label = 10;
                case 10:
                    if (!(_b < accounts_1.length)) return [3 /*break*/, 13];
                    account = accounts_1[_b];
                    categoryKey = "".concat(account.mainAccountCode, "_").concat(account.categoryName);
                    categoryId = account.categoryName ? (_d = createdCategories[categoryKey]) === null || _d === void 0 ? void 0 : _d.id : null;
                    mainAccountId = createdMainAccounts[account.mainAccountCode].id;
                    return [4 /*yield*/, prisma.account.upsert({
                            where: { code: account.code },
                            update: { balance: 0 },
                            create: {
                                code: account.code,
                                name: account.name,
                                type: account.type,
                                subType: account.subType,
                                mainAccountId: mainAccountId,
                                categoryId: categoryId,
                                balance: account.balance,
                            },
                        })];
                case 11:
                    _e.sent();
                    console.log("  Created Account: ".concat(account.code, " - ").concat(account.name));
                    _e.label = 12;
                case 12:
                    _b++;
                    return [3 /*break*/, 10];
                case 13:
                    console.log('Charts of Account created successfully!');
                    // ============ CREATE STORES ============
                    console.log('\nCreating stores...');
                    stores = ['Klagon Shop', 'Teshie Shop', 'Cape Coast Shop'];
                    _c = 0, stores_1 = stores;
                    _e.label = 14;
                case 14:
                    if (!(_c < stores_1.length)) return [3 /*break*/, 17];
                    store = stores_1[_c];
                    return [4 /*yield*/, prisma.store.upsert({
                            where: { name: store },
                            update: {},
                            create: { name: store },
                        })];
                case 15:
                    _e.sent();
                    console.log("  Created Store: ".concat(store));
                    _e.label = 16;
                case 16:
                    _c++;
                    return [3 /*break*/, 14];
                case 17:
                    console.log('Stores created successfully!');
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error(e);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
