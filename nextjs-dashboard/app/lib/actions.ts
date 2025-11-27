'use server';
import { z } from "zod";
import postgres from 'postgres';
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
 
const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });
 
const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer...'
    }),
    amount: z.coerce.number().gt(0, { message: 'Please enter an Amount greater than 0.'}),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status'
    }),
    date: z.string()
})

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true})

export type State = {
    errors?: {
        customerId?: string[]
        amount?: string[]
        status?: string[]
    };
    message?: string | null;
}
 
export async function createInvoice(prevState: State, formData: FormData) {
    // Validate form fields using zod
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    })

    // If form validation fails, return errors early. Otherwise, continue...
    if (!validatedFields.success) return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: "Missing Fields. Failed to create invoice"
    }
    
    const amountInCents = validatedFields.data.amount * 100;
    const date = new Date().toISOString().split('T')[0]

    try {
        await sql`
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES (${validatedFields.data.customerId}, ${amountInCents}, ${validatedFields.data.status}, ${date})
        `
    } catch (error) {
        return {
            message: 'Database error: Failed to create invoice'
        }
    }

    revalidatePath('/dashboard/invoices')
    redirect('/dashboard/invoices')
}

export async function updateInvoice(id: string, prevState: State, formData: FormData) {
    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    })

    if (!validatedFields.success) return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: 'Missing Fields. Failed to update invoice'
    }

    const amountInCents = validatedFields.data.amount * 100;

   try {
        await sql`
            UPDATE invoices
            SET customer_id=${validatedFields.data.customerId}, amount=${amountInCents}, status=${validatedFields.data.status}
            WHERE id=${id}
        `
   } catch (error) {
        return {
            message: 'Database error: Failed to update invoice'
        }
   }

    revalidatePath('/dashboard/invoices')
    redirect('/dashboard/invoices')
}

export async function deleteInvoice(id: string) {
    try {
        await sql`
            DELETE FROM invoices WHERE id=${id}
        `
    } catch (error) {
        return {
            message: 'Database error: Failed to delete invoice'
        }
    }
    revalidatePath('/dashboard/invoices')
}