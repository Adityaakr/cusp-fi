export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          wallet_address: string;
          kyc_verified: boolean;
          tier: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          wallet_address: string;
          kyc_verified?: boolean;
          tier?: string;
        };
        Update: {
          kyc_verified?: boolean;
          tier?: string;
          updated_at?: string;
        };
      };
      protocol_state: {
        Row: {
          id: number;
          total_tvl: number;
          cusdc_exchange_rate: number;
          reserve_usdc: number;
          deployed_usdc: number;
          total_cusdc_supply: number;
          loss_reserve: number;
          protocol_treasury: number;
          cusdc_mint: string | null;
          vault_public_key: string | null;
          updated_at: string;
        };
        Insert: never;
        Update: {
          total_tvl?: number;
          cusdc_exchange_rate?: number;
          reserve_usdc?: number;
          deployed_usdc?: number;
          total_cusdc_supply?: number;
          loss_reserve?: number;
          protocol_treasury?: number;
          cusdc_mint?: string | null;
          vault_public_key?: string | null;
          updated_at?: string;
        };
      };
      deposits: {
        Row: {
          id: string;
          user_id: string;
          amount_usdc: number;
          cusdc_minted: number;
          exchange_rate: number;
          tx_signature: string | null;
          status: "pending" | "confirmed" | "failed";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount_usdc: number;
          cusdc_minted: number;
          exchange_rate: number;
          tx_signature?: string | null;
          status?: "pending" | "confirmed" | "failed";
        };
        Update: {
          tx_signature?: string | null;
          status?: "pending" | "confirmed" | "failed";
        };
      };
      withdrawals: {
        Row: {
          id: string;
          user_id: string;
          cusdc_amount: number;
          usdc_amount: number;
          exchange_rate: number;
          withdrawal_type: "instant" | "queued";
          status: "pending" | "processing" | "completed" | "failed";
          tx_signature: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          cusdc_amount: number;
          usdc_amount: number;
          exchange_rate: number;
          withdrawal_type: "instant" | "queued";
          status?: "pending" | "processing" | "completed" | "failed";
          tx_signature?: string | null;
        };
        Update: {
          status?: "pending" | "processing" | "completed" | "failed";
          tx_signature?: string | null;
          completed_at?: string | null;
        };
      };
      positions: {
        Row: {
          id: string;
          position_type: "vault" | "leveraged" | "direct";
          user_id: string | null;
          market_ticker: string;
          side: "YES" | "NO";
          entry_price: number;
          quantity: number;
          usdc_cost: number;
          outcome_mint: string | null;
          status: "open" | "closing" | "settled" | "liquidated";
          created_at: string;
          settled_at: string | null;
          settlement_payout: number | null;
        };
        Insert: {
          id?: string;
          position_type: "vault" | "leveraged" | "direct";
          user_id?: string | null;
          market_ticker: string;
          side: "YES" | "NO";
          entry_price: number;
          quantity: number;
          usdc_cost: number;
          outcome_mint?: string | null;
          status?: "open" | "closing" | "settled" | "liquidated";
        };
        Update: {
          status?: "open" | "closing" | "settled" | "liquidated";
          settled_at?: string | null;
          settlement_payout?: number | null;
        };
      };
      leveraged_trades: {
        Row: {
          id: string;
          user_id: string;
          position_id: string;
          margin_usdc: number;
          borrowed_usdc: number;
          leverage: number;
          health_factor: number;
          borrow_rate_bps: number;
          accrued_interest: number;
          status: "active" | "liquidated" | "closed";
          created_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          position_id: string;
          margin_usdc: number;
          borrowed_usdc: number;
          leverage: number;
          health_factor?: number;
          borrow_rate_bps?: number;
        };
        Update: {
          health_factor?: number;
          accrued_interest?: number;
          status?: "active" | "liquidated" | "closed";
          closed_at?: string | null;
        };
      };
      trade_executions: {
        Row: {
          id: string;
          position_id: string;
          direction: "open" | "close" | "redeem";
          input_mint: string;
          output_mint: string;
          input_amount: number;
          output_amount: number;
          tx_signature: string | null;
          dflow_order_status: string | null;
          status: "pending" | "submitted" | "confirmed" | "failed";
          created_at: string;
        };
        Insert: {
          id?: string;
          position_id: string;
          direction: "open" | "close" | "redeem";
          input_mint: string;
          output_mint: string;
          input_amount: number;
          output_amount?: number;
          tx_signature?: string | null;
        };
        Update: {
          output_amount?: number;
          tx_signature?: string | null;
          dflow_order_status?: string | null;
          status?: "pending" | "submitted" | "confirmed" | "failed";
        };
      };
      fees: {
        Row: {
          id: string;
          fee_type: "borrow" | "execution" | "liquidation" | "close" | "platform";
          amount_usdc: number;
          source_id: string | null;
          source_type: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          fee_type: "borrow" | "execution" | "liquidation" | "close" | "platform";
          amount_usdc: number;
          source_id?: string | null;
          source_type?: string | null;
        };
        Update: never;
      };
      yield_distributions: {
        Row: {
          id: string;
          period_start: string;
          period_end: string;
          gross_revenue: number;
          loss_reserve_contribution: number;
          protocol_fee: number;
          net_lp_yield: number;
          exchange_rate_before: number;
          exchange_rate_after: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          period_start: string;
          period_end: string;
          gross_revenue: number;
          loss_reserve_contribution: number;
          protocol_fee: number;
          net_lp_yield: number;
          exchange_rate_before: number;
          exchange_rate_after: number;
        };
        Update: never;
      };
      markets_cache: {
        Row: {
          ticker: string;
          event_ticker: string;
          title: string;
          status: string;
          yes_mint: string | null;
          no_mint: string | null;
          yes_price: number | null;
          no_price: number | null;
          volume: number;
          expiration_time: number;
          data_json: string;
          updated_at: string;
        };
        Insert: {
          ticker: string;
          event_ticker: string;
          title: string;
          status: string;
          yes_mint?: string | null;
          no_mint?: string | null;
          yes_price?: number | null;
          no_price?: number | null;
          volume?: number;
          expiration_time?: number;
          data_json?: string;
        };
        Update: {
          status?: string;
          yes_mint?: string | null;
          no_mint?: string | null;
          yes_price?: number | null;
          no_price?: number | null;
          volume?: number;
          data_json?: string;
          updated_at?: string;
        };
      };
    };
    Functions: {
      get_waitlist_count: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
  };
}
