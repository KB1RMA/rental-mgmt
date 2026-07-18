import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { authClient } from '#/lib/auth-client'
import { signupSchema } from '#/lib/schemas/auth'
import type { SignupInput } from '#/lib/schemas/auth'

export const Route = createFileRoute('/signup')({ component: SignupPage })

function SignupPage() {
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) })

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null)
    const { error } = await authClient.signUp.email(data)
    if (error) {
      setFormError(error.message ?? 'Could not create account')
      return
    }
    void navigate({ to: '/' })
  })

  return (
    <div className="mx-auto mt-24 max-w-sm p-6">
      <h1 className="text-2xl font-semibold">Create admin account</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        One-time bootstrap. Disable email sign-up in{' '}
        <code>src/lib/auth.ts</code> after this account is created.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label className="block text-sm font-medium" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            type="text"
            className="mt-1 w-full border border-neutral-300 px-3 py-2 dark:border-neutral-700"
            {...register('name')}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="mt-1 w-full border border-neutral-300 px-3 py-2 dark:border-neutral-700"
            {...register('email')}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="mt-1 w-full border border-neutral-300 px-3 py-2 dark:border-neutral-700"
            {...register('password')}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">
              {errors.password.message}
            </p>
          )}
        </div>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-neutral-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {isSubmitting ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
