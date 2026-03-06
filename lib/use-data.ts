'use client'

import { useEffect, useState, useCallback } from 'react'
import * as mock from './mock-data'
import type { Customer, Inquiry, Farm, FarmRental, DailyCount } from '@/types'

const HAS_SUPABASE = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'
)

type RentalRow = Omit<FarmRental, 'farm' | 'customer'> & {
  farm: { number: number; name: string }
  customer: { name: string; phone: string }
}

export function useDashboardStats() {
  const [data, setData] = useState(mock.MOCK_STATS)
  const [loading, setLoading] = useState(HAS_SUPABASE)

  useEffect(() => {
    if (!HAS_SUPABASE) return
    const fetchStats = async () => {
      const { createClient } = await import('./supabase/client')
      const supabase = createClient()
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

      const [todayRes, unprocessedRes, convertedRes, rentedRes] = await Promise.all([
        supabase.from('inquiries').select('id', { count: 'exact', head: true }).gte('created_at', todayStr),
        supabase.from('inquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('inquiries').select('id', { count: 'exact', head: true }).eq('status', 'converted').gte('updated_at', monthStart),
        supabase.from('farms').select('id', { count: 'exact', head: true }).eq('status', 'rented'),
      ])

      setData({
        todayNew: todayRes.count ?? 0,
        unprocessed: unprocessedRes.count ?? 0,
        monthConverted: convertedRes.count ?? 0,
        rentedFarms: rentedRes.count ?? 0,
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
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!HAS_SUPABASE) {
      setData(mock.MOCK_FARMS_WITH_RENTALS)
      setLoading(false)
      return
    }
    const { createClient } = await import('./supabase/client')
    const supabase = createClient()
    const { data: farmsData } = await supabase.from('farms').select('*').order('number')
    if (!farmsData) { setLoading(false); return }

    const { data: rentals } = await supabase
      .from('farm_rentals')
      .select('*, customer:customers(name, phone)')
      .eq('status', 'active')

    const enriched: Farm[] = farmsData.map((f: Farm) => {
      const rental = rentals?.find((r: FarmRental) => r.farm_id === f.id)
      return { ...f, current_rental: rental || undefined }
    })
    setData(enriched)
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, refetch }
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
        .eq('status', 'active')
        .lte('end_date', cutoff.toISOString().split('T')[0])
        .order('end_date', { ascending: true })
      if (result) setData(result as typeof data)
      setLoading(false)
    }
    fetchExpiring()
  }, [days])

  return { data, loading }
}
