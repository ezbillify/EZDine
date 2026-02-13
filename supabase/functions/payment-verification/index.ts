import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as crypto from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const { orderId, paymentId, signature } = await req.json()

        // ... (rest of logic) ...

        // 1. Get Branch Razorpay Secrets
        // We need to fetch the branch/restaurant config to get the correct secret
        // But wait, we don't know which branch this order belongs to easily without fetching the order first.

        const { data: order, error: orderError } = await supabaseClient
            .from('orders')
            .select('branch_id, order_number')
            .eq('id', orderId)
            .single()

        if (orderError || !order) {
            throw new Error('Order not found')
        }

        // 2. Fetch Secrets
        const { data: branch, error: branchError } = await supabaseClient
            .from('branches')
            .select('razorpay_secret, razorpay_key, restaurant:restaurants(razorpay_secret, razorpay_key)')
            .eq('id', order.branch_id)
            .single()

        if (branchError) throw new Error('Branch config not found')

        // Resolve secret (Branch overrides Restaurant)
        const restaurant = Array.isArray(branch.restaurant) ? branch.restaurant[0] : branch.restaurant;
        const secret = branch.razorpay_secret || restaurant?.razorpay_secret;
        const key = branch.razorpay_key || restaurant?.razorpay_key;

        if (!secret) throw new Error('Razorpay secret not configured')

        // 3. Verify Signature
        // ... (omitted comments) ...

        const basicAuth = btoa(`${key}:${secret}`);
        const rzpResponse = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${basicAuth}`
            }
        });

        if (!rzpResponse.ok) {
            throw new Error('Failed to fetch payment from Razorpay');
        }

        const paymentData = await rzpResponse.json();

        if (paymentData.status === 'captured' || paymentData.status === 'authorized') {
            // Success!

            // 4. Update Order
            const { error: updateError } = await supabaseClient
                .from('orders')
                .update({
                    payment_status: 'paid',
                    payment_method: 'online',
                    payment_id: paymentId,
                    status: 'pending' // Ensure it sends to KDS
                })
                .eq('id', orderId);

            if (updateError) throw updateError;

            return new Response(
                JSON.stringify({ success: true, message: 'Payment verified' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        } else {
            throw new Error(`Payment status is ${paymentData.status}`);
        }

    } catch (error: any) {
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
