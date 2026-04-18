'use client'

import { useEffect, useState, useCallback } from 'react'
import * as mock from './mock-data'
import type { Customer, Inquiry, Farm, FarmRental, FarmZone, ServiceOrder, DailyCount } from '@/types'

const HAS_SUPABASE = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'
)

type RentalRow = Omit<FarmRental, 'farm' | 'customer'> & {
  farm: { number: number; name: string }
  customer: { name: string; phone: string }
}

export interface DashboardStats {
  totalFarms: number;
  rentedFarms: number;
  rentalRate: number;
  unprocessedInquiries: number;
  pendingBBQ: number;
  pendingOrders: number;
  pendingCoupons: number;
  pendingTotal: number;
  expiringThisMonth: number;
  monthlyRevenue: number;
}

export function useDashboardStats() {
  const [data, setData] = useState<DashboardStats>({
    totalFarms: 0, rentedFarms: 0, rentalRate: 0,
    unprocessedInquiries: 0,
    pendingBBQ: 0, pendingOrders: 0, pendingCoupons: 0, pendingTotal: 0,
    expiringThisMonth: 0, monthlyRevenue: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!HAS_SUPABASE) { setLoading(false); return }
    const fetchStats = async () => {
      const { createClient } = await import('./supabase/client')
      const supabase = createClient()
      const today = new Date()
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]

      const [
        totalFarmsRes, rentedFarmsRes,
        inquiriesRes,
        bbqRes, ordersRes, couponsRes,
        expiringRes, revenueRes,
      ] = await Promise.all([
        supabase.from('farms_active').select('id', { count: 'exact', head: true }),
        supabase.from('farms_active').select('id', { count: 'exact', head: true }).eq('status', 'rented'),
        supabase.from('inquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('bbq_reservations').select('id', { count: 'exact', head: true }).eq('status', 'confirmed').gte('reservation_date', today.toISOString().split('T')[0]),
        supabase.from('service_orders').select('id', { count: 'exact', head: true }).in('status', ['payment_pending', 'processing']),
        supabase.from('coupon_issues').select('id', { count: 'exact', head: true }).eq('status', 'issued'),
        supabase.from('farm_rentals').select('id', { count: 'exact', head: true }).eq('status', 'active').lte('end_date', monthEnd).gte('end_date', monthStart),
        supabase.from('farm_rentals').select('monthly_fee').eq('payment_status', '납부완료').gte('created_at', monthStart),
      ])

      const total = totalFarmsRes.count ?? 0
      const rented = rentedFarmsRes.count ?? 0
      const pBBQ = bbqRes.count ?? 0
      const pOrders = ordersRes.count ?? 0
      const pCoupons = couponsRes.count ?? 0
      const revenue = (revenueRes.data || []).reduce((sum: number, r: { monthly_fee: number }) => sum + (r.monthly_fee || 0), 0)

      setData({
        totalFarms: total,
        rentedFarms: rented,
        rentalRate: total > 0 ? Math.round((rented / total) * 100) : 0,
        unprocessedInquiries: inquiriesRes.count ?? 0,
        pendingBBQ: pBBQ,
        pendingOrders: pOrders,
        pendingCoupons: pCoupons,
        pendingTotal: pBBQ + pOrders + pCoupons,
        expiringThisMonth: expiringRes.count ?? 0,
        monthlyRevenue: revenue,
      })
      setLoading(false)
    }
    fetchStats()
  }, [])

  return { data, loading }
}

export function useInquiries(filters?: { type?: string; status?: string; search?: string }) {
  const [data, setData] = useState<(Inquiry & { customer?: Customer })[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!HAS_SUPABASE) {
      let filtered: (Inquiry & { customer?: Customer })[] = [...mock.MOCK_INQUIRIES]
      if (filters?.type) filtered = filtered.filter(i => i.type === filters.type)
      if (filters?.status) filtered = filtered.filter(i => i.status === filters.status)
      if (filters?.search) {
        const s = filters.search.toLowerCase()
        filtered = filtered.filter(i =>
          i.customer?.name?.toLowerCase().includes(s) || i.customer?.phone?.includes(s)
        )
      }
      setData(filtered)
      setLoading(false)
      return
    }
    const { createClient } = await import('./supabase/client')
    const supabase = createClient()
    let query = supabase
      .from('inquiries')
      .select('*, customer:customers(*), assignee:profiles(*)')
      .order('created_at', { ascending: false })

    if (filters?.type) query = query.eq('type', filters.type)
    if (filters?.status) query = query.eq('status', filters.status)

    const { data: result } = await query
    let filtered = result || []
    if (filters?.search) {
      const s = filters.search.toLowerCase()
      filtered = filtered.filter((inq: Inquiry & { customer?: Customer }) =>
        inq.customer?.name?.toLowerCase().includes(s) || inq.customer?.phone?.includes(s)
      )
    }
    setData(filtered)
    setLoading(false)
  }, [filters?.type, filters?.status, filters?.search])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, refetch }
}

export function useChartData() {
  const [data, setData] = useState<DailyCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!HAS_SUPABASE) {
      setData(mock.generateChartData())
      setLoading(false)
      return
    }
    const fetchData = async () => {
      const { createClient } = await import('./supabase/client')
      const { subDays, format } = await import('date-fns')
      const supabase = createClient()
      const days = 30
      const startDate = subDays(new Date(), days)

      const { data: inquiries } = await supabase
        .from('inquiries')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })

      const countMap: Record<string, number> = {}
      for (let i = 0; i <= days; i++) {
        const date = format(subDays(new Date(), days - i), 'MM/dd')
        countMap[date] = 0
      }
      inquiries?.forEach((inq: { created_at: string }) => {
        const date = format(new Date(inq.created_at), 'MM/dd')
        if (countMap[date] !== undefined) countMap[date]++
      })
      setData(Object.entries(countMap).map(([date, count]) => ({ date, count })))
      setLoading(false)
    }
    fetchData()
  }, [])

  return { data, loading }
}

export function useCustomers() {
  const [data, setData] = useState<(Customer & { inquiry_count: number })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!HAS_SUPABASE) {
      const customerInquiryCounts: Record<string, { count: number; lastAt: string | undefined }> = {}
      mock.MOCK_INQUIRIES.forEach(inq => {
        const prev = customerInquiryCounts[inq.customer_id] || { count: 0, lastAt: undefined }
        prev.count++
        if (!prev.lastAt || inq.created_at > prev.lastAt) prev.lastAt = inq.created_at
        customerInquiryCounts[inq.customer_id] = prev
      })
      const rows = mock.MOCK_CUSTOMERS.map(c => ({
        ...c,
        inquiry_count: customerInquiryCounts[c.id]?.count ?? 0,
        last_inquiry_at: customerInquiryCounts[c.id]?.lastAt,
      })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setData(rows)
      setLoading(false)
      return
    }
    const fetchCustomers = async () => {
      const { createClient } = await import('./supabase/client')
      const supabase = createClient()
      const { data: custs } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      if (!custs) { setLoading(false); return }

      const rows = await Promise.all(
        custs.map(async (c: Customer) => {
          const { count } = await supabase
            .from('inquiries')
            .select('id', { count: 'exact', head: true })
            .eq('customer_id', c.id)
          const { data: latest } = await supabase
            .from('inquiries')
            .select('created_at')
            .eq('customer_id', c.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
          return { ...c, inquiry_count: count ?? 0, last_inquiry_at: latest?.created_at || undefined }
        })
      )
      setData(rows)
      setLoading(false)
    }
    fetchCustomers()
  }, [])

  return { data, loading }
}

export function useFarms() {
  const [data, setData] = useState<Farm[]>([])
  const [zones, setZones] = useState<FarmZone[]>([])
  const [pendingOrders, setPendingOrders] = useState<(ServiceOrder & { product?: { name: string }; member?: { name: string } })[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!HAS_SUPABASE) {
      setData(mock.MOCK_FARMS_WITH_RENTALS)
      setLoading(false)
      return
    }
    const { createClient } = await import('./supabase/client')
    const supabase = createClient()

    const [farmsRes, rentalsRes, zonesRes, ordersRes] = await Promise.all([
      supabase.from('farms_active').select('*').order('number'),
      supabase.from('farm_rentals').select('*, customer:customers(name, phone)').eq('status', 'active'),
      supabase.from('farm_zones_active').select('*').order('sort_order'),
      supabase.from('service_orders').select('*, product:store_products(name), member:members(name)').in('status', ['payment_pending', 'processing']).order('created_at', { ascending: false }),
    ])

    if (!farmsRes.data) { setLoading(false); return }

    const enriched: Farm[] = farmsRes.data.map((f: Farm) => {
      const rental = rentalsRes.data?.find((r: FarmRental) => r.farm_id === f.id)
      return { ...f, current_rental: rental || undefined }
    })
    setData(enriched)
    setZones(zonesRes.data || [])
    setPendingOrders(ordersRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, zones, pendingOrders, loading, refetch }
}

export function useRentals(statusFilter?: string) {
  const [data, setData] = useState<RentalRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!HAS_SUPABASE) {
      let filtered: RentalRow[] = mock.MOCK_RENTALS.map(r => {
        const { farm: _f, customer: _c, ...rest } = r
        return {
          ...rest,
          farm: { number: r.farm.number, name: r.farm.name },
          customer: { name: r.customer.name, phone: r.customer.phone },
        }
      })
      if (statusFilter) filtered = filtered.filter(r => r.status === statusFilter)
      setData(filtered)
      setLoading(false)
      return
    }
    const fetchRentals = async () => {
      const { createClient } = await import('./supabase/client')
      const supabase = createClient()
      let query = supabase
        .from('farm_rentals')
        .select('*, farm:farms(number, name), customer:customers(name, phone)')
        .order('created_at', { ascending: false })
      if (statusFilter) query = query.eq('status', statusFilter)
      const { data: result } = await query
      if (result) setData(result as typeof data)
      setLoading(false)
    }
    fetchRentals()
  }, [statusFilter])

  return { data, loading }
}

export function useExpiringRentals(days = 30) {
  const [data, setData] = useState<RentalRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!HAS_SUPABASE) {
      const today = new Date()
      const cutoff = new Date(today)
      cutoff.setDate(cutoff.getDate() + days)

      const expiring: RentalRow[] = mock.MOCK_RENTALS
        .filter(r => r.status === 'active' && new Date(r.end_date) <= cutoff)
        .map(r => {
          const { farm: _f, customer: _c, ...rest } = r
          return {
            ...rest,
            farm: { number: r.farm.number, name: r.farm.name },
            customer: { name: r.customer.name, phone: r.customer.phone },
          }
        })
        .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime())
      setData(expiring)
      setLoading(false)
      return
    }
    const fetchExpiring = async () => {
      const { createClient } = await import('./supabase/client')
      const { addDays } = await import('date-fns')
      const supabase = createClient()
      const cutoff = addDays(new Date(), days)
      const { data: result } = await supabase
        .from('farm_rentals')
        .select('*, farm:farms(number, name), customer:customers(name, phone)')
        .in('status', ['active', 'expired'])
        .lte('end_date', cutoff.toISOString().split('T')[0])
        .order('end_date', { ascending: true })
      if (result) setData(result as typeof data)
      setLoading(false)
    }
    fetchExpiring()
  }, [days])

  return { data, loading }
}
