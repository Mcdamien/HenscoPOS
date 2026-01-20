'use client'

import { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, TrendingDown, PieChart, BarChart3, Calculator, FileText, CreditCard, Banknote, Receipt, Plus, Briefcase } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn, formatDateDDMMYYYY } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import TransactionModal from './TransactionModal'
import AccountingReportsModal from './AccountingReportsModal'

interface AccountingStats {
  totalIncome: number
  totalExpenditure: number
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  netProfit: number
  cashFlow: number
}

interface AccountEntry {
  id: number
  date: string
  description: string
  amount: number
  type: 'income' | 'expenditure' | 'asset' | 'liability' | 'equity'
  account: string
  otherAccount: string
  debit: number
  credit: number
}

export default function AccountingView() {
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<AccountingStats>({
    totalIncome: 0,
    totalExpenditure: 0,
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    netProfit: 0,
    cashFlow: 0
  })
  const [entries, setEntries] = useState<AccountEntry[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [transactionType, setTransactionType] = useState<'income' | 'expenditure' | 'asset' | 'liability' | 'equity'>('income')
  const [reportsModalOpen, setReportsModalOpen] = useState(false)

  useEffect(() => {
    const fetchAccountingData = async () => {
      try {
        const [statsRes, entriesRes] = await Promise.all([
          fetch('/api/accounting/stats'),
          fetch('/api/accounting')
        ])

        if (statsRes.ok && entriesRes.ok) {
          const statsData = await statsRes.json()
          const entriesData = await entriesRes.json()
          setStats(statsData)
          setEntries(entriesData)
        }
      } catch (error) {
        console.error('Failed to fetch accounting data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAccountingData()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      currencyDisplay: 'code'
    }).format(amount)
  }

  const openTransactionModal = (type: 'income' | 'expenditure' | 'asset' | 'liability' | 'equity') => {
    setTransactionType(type)
    setModalOpen(true)
  }

  const handleTransactionSuccess = async (transaction: Omit<AccountEntry, 'id'>) => {
    // Refresh all data from server to ensure stats are updated correctly
    setLoading(true)
    try {
      const [statsRes, entriesRes] = await Promise.all([
        fetch('/api/accounting/stats'),
        fetch('/api/accounting')
      ])

      if (statsRes.ok && entriesRes.ok) {
        const statsData = await statsRes.json()
        const entriesData = await entriesRes.json()
        setStats(statsData)
        setEntries(entriesData)
      }
    } catch (error) {
      console.error('Failed to refresh accounting data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Helper function to get display name for account
  const getAccountDisplayName = (entry: AccountEntry): string => {
    if (entry.otherAccount) {
      return entry.otherAccount
    }
    return entry.account
  }

  const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">{title}</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
            {trend && (
              <div className={`flex items-center gap-1 text-xs mt-2 ${color}`}>
                {trend}
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl ${color.replace('text-', 'bg-').replace('-600', '-100')}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const AccountTable = ({ title, data, type }: { title: string, data: AccountEntry[], type: string }) => (
    <Card>
      <CardHeader>
        <div className={cn(
          "flex items-center justify-between",
          isMobile && "flex-col items-start gap-4"
        )}>
          <CardTitle className="flex items-center gap-2">
            {type === 'income' && <TrendingUp className="w-5 h-5 text-green-600" />}
            {type === 'expenditure' && <TrendingDown className="w-5 h-5 text-red-600" />}
            {type === 'asset' && <Banknote className="w-5 h-5 text-blue-600" />}
            {type === 'liability' && <CreditCard className="w-5 h-5 text-orange-600" />}
            {type === 'equity' && <Briefcase className="w-5 h-5 text-purple-600" />}
            {title}
          </CardTitle>
          <Button 
            size="sm" 
            onClick={() => openTransactionModal(type as 'income' | 'expenditure' | 'asset' | 'liability' | 'equity')} 
            className={cn("flex items-center gap-1", isMobile && "w-full justify-center")}
          >
            <Plus className="w-4 h-4" />
            Add Transaction
          </Button>
        </div>
      </CardHeader>
      <CardContent className={isMobile ? "p-4" : ""}>
        {isMobile ? (
          <div className="space-y-4">
            {data.length === 0 ? (
              <div className="text-center text-slate-500 py-8">No entries yet</div>
            ) : (
              data.map((entry) => (
                <Card key={entry.id} className="p-4 border shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        {formatDateDDMMYYYY(entry.date)}
                      </p>
                      <h4 className="font-bold text-slate-800 leading-tight">{entry.description}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900 leading-none">
                        {formatCurrency(entry.amount)}
                      </p>
                      <Badge variant="outline" className="mt-2 text-[9px] uppercase font-black">
                        {getAccountDisplayName(entry)}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                      No entries yet
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDateDDMMYYYY(entry.date)}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getAccountDisplayName(entry)}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(entry.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )

  if (loading) {
    return <div className="p-8 text-center">Loading accounting data...</div>
  }

  return (
    <div className="pt-0 px-2 pb-8 h-full overflow-y-auto">
      <div className={cn(
        "flex items-center justify-between mb-4",
        isMobile && "flex-col items-start gap-4"
      )}>
        <h2 className="text-2xl font-semibold">Accounting Module</h2>
        <Button 
          variant="outline" 
          className={cn("flex items-center gap-2", isMobile && "w-full justify-center")} 
          onClick={() => setReportsModalOpen(true)}
        >
          <FileText className="w-4 h-4" />
          Generate Report
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="w-full overflow-x-auto pb-2 scrollbar-none">
          <TabsList className={cn(
            "inline-flex w-auto min-w-full",
            !isMobile && "grid grid-cols-7 w-full"
          )}>
            <TabsTrigger value="overview" className="flex-1 whitespace-nowrap px-4">Overview</TabsTrigger>
            <TabsTrigger value="income" className="flex-1 whitespace-nowrap px-4">Income</TabsTrigger>
            <TabsTrigger value="expenditure" className="flex-1 whitespace-nowrap px-4">Expenditure</TabsTrigger>
            <TabsTrigger value="assets" className="flex-1 whitespace-nowrap px-4">Assets</TabsTrigger>
            <TabsTrigger value="liabilities" className="flex-1 whitespace-nowrap px-4">Liabilities</TabsTrigger>
            <TabsTrigger value="equity" className="flex-1 whitespace-nowrap px-4">Equity</TabsTrigger>
            <TabsTrigger value="profit-loss" className="flex-1 whitespace-nowrap px-4">Finance Summary</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Financial Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard
              title="Total Income"
              value={formatCurrency(stats.totalIncome)}
              icon={TrendingUp}
              color="text-green-600"
              trend={<><TrendingUp className="w-4 h-4" /> Revenue streams</>}
            />
            <StatCard
              title="Total Expenditure"
              value={formatCurrency(stats.totalExpenditure)}
              icon={TrendingDown}
              color="text-red-600"
              trend={<><TrendingDown className="w-4 h-4" /> Operating costs</>}
            />
            <StatCard
              title="Net Profit"
              value={formatCurrency(stats.netProfit)}
              icon={Calculator}
              color="text-emerald-600"
              trend={<><Calculator className="w-4 h-4" /> Profit margin</>}
            />
            <StatCard
              title="Total Assets"
              value={formatCurrency(stats.totalAssets)}
              icon={Banknote}
              color="text-blue-600"
              trend={<><Banknote className="w-4 h-4" /> Company value</>}
            />
            <StatCard
              title="Total Liabilities"
              value={formatCurrency(stats.totalLiabilities)}
              icon={CreditCard}
              color="text-orange-600"
              trend={<><CreditCard className="w-4 h-4" /> Outstanding debts</>}
            />
            <StatCard
              title="Total Equity"
              value={formatCurrency(stats.totalEquity)}
              icon={Briefcase}
              color="text-purple-600"
              trend={<><Briefcase className="w-4 h-4" /> Shareholders equity</>}
            />
            <StatCard
              title="Cash Flow"
              value={formatCurrency(stats.cashFlow)}
              icon={PieChart}
              color="text-indigo-600"
              trend={<><PieChart className="w-4 h-4" /> Liquidity status</>}
            />
          </div>

          {/* Recent Accounting Entries */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Accounting Entries</CardTitle>
            </CardHeader>
            <CardContent className={isMobile ? "p-4" : ""}>
              {isMobile ? (
                <div className="space-y-4">
                  {entries.slice(0, 10).map((entry) => (
                    <Card key={entry.id} className="p-4 border shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                              {formatDateDDMMYYYY(entry.date)}
                            </p>
                            <Badge
                              className={cn(
                                "text-[9px] uppercase font-black px-1.5 h-4",
                                entry.type === 'income' && 'bg-green-100 text-green-700',
                                entry.type === 'expenditure' && 'bg-red-100 text-red-700',
                                entry.type === 'asset' && 'bg-blue-100 text-blue-700',
                                entry.type === 'liability' && 'bg-orange-100 text-orange-700',
                                entry.type === 'equity' && 'bg-purple-100 text-purple-700'
                              )}
                            >
                              {entry.type}
                            </Badge>
                          </div>
                          <h4 className="font-bold text-slate-800 leading-tight">{entry.description}</h4>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900 leading-none">
                            {formatCurrency(entry.amount)}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">
                            {getAccountDisplayName(entry)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.slice(0, 10).map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDateDDMMYYYY(entry.date)}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              entry.type === 'income' && 'bg-green-100 text-green-700',
                              entry.type === 'expenditure' && 'bg-red-100 text-red-700',
                              entry.type === 'asset' && 'bg-blue-100 text-blue-700',
                              entry.type === 'liability' && 'bg-orange-100 text-orange-700',
                              entry.type === 'equity' && 'bg-purple-100 text-purple-700'
                            )}
                          >
                            {entry.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{getAccountDisplayName(entry)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(entry.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income">
          <AccountTable
            title="Income Accounts"
            data={entries.filter(e => e.type === 'income')}
            type="income"
          />
        </TabsContent>

        <TabsContent value="expenditure">
          <AccountTable
            title="Expenditure Accounts"
            data={entries.filter(e => e.type === 'expenditure')}
            type="expenditure"
          />
        </TabsContent>

        <TabsContent value="assets">
          <AccountTable
            title="Assets"
            data={entries.filter(e => e.type === 'asset')}
            type="asset"
          />
        </TabsContent>

        <TabsContent value="liabilities">
          <AccountTable
            title="Liabilities"
            data={entries.filter(e => e.type === 'liability')}
            type="liability"
          />
        </TabsContent>

        <TabsContent value="equity">
          <AccountTable
            title="Equity Accounts"
            data={entries.filter(e => e.type === 'equity')}
            type="equity"
          />
        </TabsContent>

        <TabsContent value="profit-loss" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Income Statement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Revenue</span>
                  <span className="font-medium">{formatCurrency(stats.totalIncome)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Expenses</span>
                  <span className="font-medium text-red-600">-{formatCurrency(stats.totalExpenditure)}</span>
                </div>
                <hr />
                <div className="flex justify-between text-lg font-bold">
                  <span>Net Profit</span>
                  <span className="text-green-600">{formatCurrency(stats.netProfit)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-blue-600">Balance Sheet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Assets</span>
                  <span className="font-medium">{formatCurrency(stats.totalAssets)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Liabilities</span>
                  <span className="font-medium text-orange-600">-{formatCurrency(stats.totalLiabilities)}</span>
                </div>
                <hr />
                <div className="flex justify-between text-lg font-bold">
                  <span>Equity</span>
                  <span className="text-blue-600">{formatCurrency(stats.totalAssets - stats.totalLiabilities)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <TransactionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleTransactionSuccess}
        type={transactionType}
      />

      <AccountingReportsModal
        isOpen={reportsModalOpen}
        onClose={() => setReportsModalOpen(false)}
      />
    </div>
  )
}
