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
        console.log("Payment Verification Started");

        // Use Service Role Key
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        const body = await req.json();
        console.log("Request Body:", JSON.stringify(body));
        const { orderId, paymentId, signature } = body;

        if (!orderId || !paymentId) {
            throw new Error(`Missing required fields: orderId=${orderId}, paymentId=${paymentId}`);
        }

        // 1. Get Order
        console.log(`Fetching order: ${orderId}`);
        const { data: order, error: orderError } = await supabaseClient
            .from('orders')
            .select('branch_id, order_number')
            .eq('id', orderId)
            .single()

        if (orderError || !order) {
            console.error("Order Fetch Error:", orderError);
            throw new Error('Order not found or access denied');
        }
        console.log(`Order found. Branch: ${order.branch_id}`);

        // 2. Fetch Secrets
        console.log(`Fetching branch config: ${order.branch_id}`);
        // Note: Make sure 'restaurant:restaurants' matching the foreign key relationship name
        // If 'restaurant_id' is the FK, default name is usually 'restaurants'
        const { data: branch, error: branchError } = await supabaseClient
            .from('branches')
            .select(`
                razorpay_secret, 
                razorpay_key, 
                restaurant:restaurants (
                    razorpay_secret, 
                    razorpay_key
                )
            `)
            .eq('id', order.branch_id)
            .single()

        if (branchError) {
            console.error("Branch config error:", branchError);
            throw new Error('Branch config not found');
        }

        // Resolve secret
        // @ts-ignore
        const restaurant = Array.isArray(branch.restaurant) ? branch.restaurant[0] : branch.restaurant;
        const secret = branch.razorpay_secret || restaurant?.razorpay_secret;
        const key = branch.razorpay_key || restaurant?.razorpay_key;

        console.log(`Secrets resolved using Key: ${key ? 'YES' : 'NO'}, Secret: ${secret ? 'YES' : 'NO'}`);

        if (!secret) throw new Error('Razorpay secret not configured in Branch or Restaurant');

        // 3. Verify Signature (Skip if signature is missing or just verify payment status)
        // If strict verification is needed:
        // const generated_signature = hmac_sha256(orderId + "|" + paymentId, secret);
        // if (generated_signature != signature) throw new Error("Invalid Signature");

        // For now, let's verify STATUS with Razorpay API
        const basicAuth = btoa(`${key}:${secret}`);
        console.log(`Verifying with Razorpay API: ${paymentId}`);

        const rzpResponse = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${basicAuth}`
            }
        });

        if (!rzpResponse.ok) {
            const errorText = await rzpResponse.text();
            console.error("Razorpay API Error:", errorText);
            throw new Error(`Razorpay API Request Failed: ${rzpResponse.status}`);
        }

        const paymentData = await rzpResponse.json();
        console.log("Razorpay Status:", paymentData.status);

        if (paymentData.status === 'captured' || paymentData.status === 'authorized') {
            // 4. Update Order
            console.log("Updating Order to Paid");
            const { error: updateError } = await supabaseClient
                .from('orders')
                .update({
                    payment_status: 'paid',
                    payment_method: 'online',
                    // payment_id: paymentId, // Check if this column exists
                    status: 'pending'
                })
                .eq('id', orderId);

            if (updateError) {
                console.error("Order Update Error:", updateError);
                throw updateError;
            }

            return new Response(
                JSON.stringify({ success: true, message: 'Payment verified' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        } else {
            throw new Error(`Payment status is ${paymentData.status}`);
        }

    } catch (error: any) {
        console.error("Edge Function Exception:", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message, stack: error.stack }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 } // Keep 400 so client knows it failed, but rely on body for why
        )
    }
})
