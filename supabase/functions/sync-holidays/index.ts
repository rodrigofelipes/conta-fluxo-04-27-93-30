import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface HolidayAPI {
  date: string;
  name: string;
  type?: string;
  nationwide?: boolean;
}

interface BrasilAPIHoliday {
  date: string;
  name: string;
  type: string;
}

interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  types: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { year } = await req.json()
    
    if (!year || year < 2020 || year > 2030) {
      return new Response(
        JSON.stringify({ error: 'Ano inválido. Use um ano entre 2020 e 2030.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Sincronizando feriados para o ano ${year}`)

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verificar se já existem feriados para este ano
    const { data: existingHolidays } = await supabase
      .from('holidays')
      .select('date')
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`)

    const existingDates = existingHolidays?.map(h => h.date) || []
    console.log(`Feriados existentes para ${year}:`, existingDates.length)

    let holidays: HolidayAPI[] = []

    // Tentativa 1: BrasilAPI
    try {
      console.log('Tentando BrasilAPI...')
      const brasilResponse = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`)
      
      if (brasilResponse.ok) {
        const brasilHolidays: BrasilAPIHoliday[] = await brasilResponse.json()
        holidays = brasilHolidays.map(h => ({
          date: h.date,
          name: h.name,
          type: h.type,
          nationwide: true
        }))
        console.log(`BrasilAPI retornou ${holidays.length} feriados`)
      } else {
        throw new Error(`BrasilAPI falhou: ${brasilResponse.status}`)
      }
    } catch (error) {
      console.log('BrasilAPI falhou:', error.message)
      
      // Tentativa 2: Nager.Date
      try {
        console.log('Tentando Nager.Date...')
        const nagerResponse = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/BR`)
        
        if (nagerResponse.ok) {
          const nagerHolidays: NagerHoliday[] = await nagerResponse.json()
          holidays = nagerHolidays.map(h => ({
            date: h.date,
            name: h.localName || h.name,
            type: h.types?.join(', ') || 'Public',
            nationwide: h.global
          }))
          console.log(`Nager.Date retornou ${holidays.length} feriados`)
        } else {
          throw new Error(`Nager.Date falhou: ${nagerResponse.status}`)
        }
      } catch (nagerError) {
        console.log('Nager.Date também falhou:', nagerError.message)
        return new Response(
          JSON.stringify({ 
            error: 'Falha ao acessar APIs de feriados. Tente novamente mais tarde.',
            details: `BrasilAPI: ${error.message}, Nager.Date: ${nagerError.message}`
          }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Filtrar feriados que já não existem no banco
    const newHolidays = holidays.filter(h => !existingDates.includes(h.date))
    console.log(`Novos feriados para inserir: ${newHolidays.length}`)

    if (newHolidays.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: `Todos os feriados de ${year} já estão sincronizados.`,
          total: holidays.length,
          inserted: 0,
          existing: existingDates.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obter o usuário atual para definir created_by
    const authHeader = req.headers.get('Authorization')
    let userId = null
    
    if (authHeader) {
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
      const { data: { user } } = await supabaseAuth.auth.getUser(authHeader.replace('Bearer ', ''))
      userId = user?.id
    }

    // Inserir novos feriados
    const holidaysToInsert = newHolidays.map(h => ({
      name: h.name,
      date: h.date,
      description: `Feriado nacional brasileiro${h.type ? ` (${h.type})` : ''}`,
      is_national: h.nationwide !== false,
      created_by: userId
    }))

    const { data, error } = await supabase
      .from('holidays')
      .insert(holidaysToInsert)
      .select()

    if (error) {
      console.error('Erro ao inserir feriados:', error)
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar feriados no banco de dados.', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`${data.length} feriados inseridos com sucesso`)

    return new Response(
      JSON.stringify({
        message: `Sincronização concluída! ${data.length} novos feriados adicionados para ${year}.`,
        total: holidays.length,
        inserted: data.length,
        existing: existingDates.length,
        holidays: data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro na sincronização:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor.', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})