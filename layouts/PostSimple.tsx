import Link from '@/components/Link';
import PageTitle from '@/components/PageTitle';
import SectionContainer from '@/components/SectionContainer';
import { BlogSEO } from '@/components/SEO';
import siteMetadata from '@/data/siteMetadata';
import formatDate from '@/lib/utils/formatDate';
import Comments from '@/components/comments';
import ScrollTopAndComment from '@/components/ScrollTopAndComment';
import { ReactNode } from 'react';
import { PostFrontMatter } from 'types/PostFrontMatter';

interface Props {
  frontMatter: PostFrontMatter;
  children: ReactNode;
  next?: { slug: string; title: string };
  prev?: { slug: string; title: string };
}

export default function PostLayout({
  frontMatter,
  next,
  prev,
  children,
}: Props) {
  const { slug, date, title } = frontMatter;

  return (
    <SectionContainer>
      <ScrollTopAndComment />
      <article className='fade-in'>
        <div>
          <header>
            <div className='space-y-1 border-b border-gray-100 pb-10 text-center dark:border-gray-800'>
              <dl>
                <div>
                  <dt className='sr-only'>Published on</dt>
                  <dd className='text-base font-medium leading-6 text-gray-500 dark:text-gray-400'>
                    <time dateTime={date}>{formatDate(date)}</time>
                  </dd>
                </div>
              </dl>
              <div>
                <PageTitle>{title}</PageTitle>
              </div>
            </div>
          </header>
          <div
            className='divide-y divide-gray-100 pb-8 dark:divide-gray-800 xl:divide-y-0 '
            style={{ gridTemplateRows: 'auto 1fr' }}
          >
            <div className='divide-y-2 divide-gray-100 dark:divide-gray-800 xl:col-span-3 xl:row-span-2 xl:pb-0'>
              <div className='prose max-w-none pb-8 pt-10 dark:prose-dark'>
                {children}
              </div>
            </div>
            <Comments frontMatter={frontMatter} />
          </div>
        </div>
      </article>
    </SectionContainer>
  );
}
