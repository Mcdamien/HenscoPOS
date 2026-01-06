# TypeScript Error Fixes TODO

## Step 1: Install Missing Dependencies
- [x] Add socket.io to package.json dependencies
- [x] Add socket.io-client to package.json dependencies

## Step 2: Fix NextConfig
- [x] Remove invalid 'eslint' property from next.config.ts

## Step 3: Fix Prisma Schema
- [x] Change MainAccount.id from String to Int with autoincrement
- [x] Change AccountCategory.id from String to Int with autoincrement
- [x] Change Account.categoryId and mainAccountId to Int?
- [ ] Run prisma generate

## Step 4: Fix Seed File
- [ ] Fix CreatedAccount interface to use id: number
- [ ] Fix MainAccount creation to use AccountType enum
- [ ] Fix category lookup logic to use .id properly
- [ ] Fix Account creation to use AccountType and AccountSubType enums
- [ ] Fix AccountCategory filter to use number for id

## Step 5: Verification
- [ ] Run type check to verify all errors are fixed

